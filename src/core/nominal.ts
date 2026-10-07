import type { StandardJSONSchemaV1 } from '@standard-schema/spec';

import { ChainSchema, runSchema } from './chain-schema.ts';
import type {
  AnyNominalType,
  InputOf,
  NominalSchema,
  NominalType,
  Parsed,
  ValueOf,
} from './contracts.ts';
import {
  brandKeySlot,
  descendsFrom,
  isVariantPair,
  levelOf,
  levelSlot,
  rulesOf,
  variantSourceSlot,
} from './hierarchy.ts';
import { NominalError } from './nominal-error.ts';
import { PatternSchema } from './pattern-schema.ts';
import { Rejection } from './rejection.ts';
import type { StandardProps } from './standard-schema.ts';
import { withoutImpliedString } from './string-rule.ts';

const namespace = '@horizon-republic/nominal-types';
const effectiveSchemas = new WeakMap<object, NominalSchema>();
const standardProps = new WeakMap<object, StandardProps<unknown, NominalRoot>>();

let pendingTarget: object | undefined;
let pendingInput: unknown;
let pendingValue: unknown;

const remember = (target: object, input: unknown, value: unknown): void => {
  pendingTarget = target;
  pendingInput = input;
  pendingValue = value;
};

const effectiveSchemaOf = (target: typeof NominalRoot): NominalSchema => {
  const cached = effectiveSchemas.get(target);
  if (cached !== undefined) {
    return cached;
  }
  const rules = withoutImpliedString(rulesOf(NominalRoot, target));
  const [only] = rules;
  const schema = rules.length === 1 && only !== undefined ? only : new ChainSchema(rules);
  effectiveSchemas.set(target, schema);
  return schema;
};

const run = (target: typeof NominalRoot, input: unknown): unknown => {
  try {
    return runSchema(effectiveSchemaOf(target), input);
  } catch (error) {
    throw new TypeError(
      `${target.typeName}: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      },
    );
  }
};

const toSchema = (schema: NominalSchema | RegExp): NominalSchema =>
  schema instanceof RegExp ? new PatternSchema(schema) : schema;

const converterOf = (target: typeof NominalRoot): StandardJSONSchemaV1.Converter => {
  const converter = effectiveSchemaOf(target)['~standard'].jsonSchema;
  if (converter === undefined) {
    throw new TypeError(`${target.typeName}: the schema cannot describe itself as JSON Schema`);
  }
  return converter;
};

class NominalRoot {
  public static readonly typeName: string = 'Nominal';
  declare public static readonly rule: NominalSchema;
  public readonly value: unknown;

  public constructor(input: unknown) {
    const target = new.target;
    if (pendingTarget === target && Object.is(pendingInput, input)) {
      this.value = pendingValue;
      pendingTarget = undefined;
      return;
    }
    const value = run(target, input);
    if (value instanceof Rejection) {
      throw new NominalError(target.typeName, value.issues);
    }
    this.value = value;
  }

  public static get '~standard'(): StandardProps<unknown, NominalRoot> {
    const cached = standardProps.get(this);
    if (cached !== undefined) {
      return cached;
    }
    const props: StandardProps<unknown, NominalRoot> = {
      version: 1,
      vendor: namespace,
      validate: (value) => {
        const parsed = this.parse(value);
        return parsed.ok ? { value: parsed.value } : { issues: parsed.issues };
      },
      jsonSchema: {
        input: (options) => converterOf(this).input(options),
        output: (options) => converterOf(this).output(options),
      },
    };
    standardProps.set(this, props);
    return props;
  }

  public static [Symbol.hasInstance](value: unknown): boolean {
    const key: unknown = Reflect.get(this, brandKeySlot);
    if (typeof key !== 'symbol') {
      return Function.prototype[Symbol.hasInstance].call(this, value);
    }
    return typeof value === 'object' && value !== null && Reflect.get(value, key) === true;
  }

  public static parse(this: typeof NominalRoot, input: unknown): Parsed<NominalRoot> {
    const result = constructOwn(this, input);
    return result instanceof Rejection
      ? { ok: false, issues: result.issues }
      : { ok: true, value: result };
  }

  public static subtype(
    this: typeof NominalRoot,
    name: string,
    constraint?: NominalSchema | RegExp,
  ): typeof NominalRoot {
    return derive(this, name, constraint === undefined ? undefined : toSchema(constraint), this);
  }

  public static variant(
    this: typeof NominalRoot,
    name: string,
    rule: NominalSchema | RegExp,
  ): typeof NominalRoot {
    const level = levelOf(NominalRoot, this);
    const derived = derive(this, name, toSchema(rule), level.base);
    for (const key of level.keys) {
      Object.defineProperty(derived.prototype, key, { value: false });
    }
    Object.defineProperty(derived, variantSourceSlot, { value: level.keys });
    return derived;
  }

  public equals(other: unknown): boolean {
    return (
      other instanceof NominalRoot &&
      Reflect.get(other.constructor, 'typeName') === Reflect.get(this.constructor, 'typeName') &&
      sameValue(other.value, this.value)
    );
  }

  public toJSON(): unknown {
    return this.value;
  }

  public toString(): string {
    return String(this.value);
  }
}

const hasEquals = (value: unknown): value is { equals: (other: unknown) => boolean } =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'equals') === 'function';

const sameValue = (left: unknown, right: unknown): boolean =>
  Object.is(left, right) ||
  (Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((item: unknown, index) =>
      hasEquals(item) ? item.equals(right[index]) : sameValue(item, right[index]),
    ));

const isOwnType = (value: unknown): value is typeof NominalRoot =>
  typeof value === 'function' && Object.prototype.isPrototypeOf.call(NominalRoot, value);

const constructOwn = (target: typeof NominalRoot, input: unknown): NominalRoot | Rejection => {
  if (typeof input === 'object' && input !== null) {
    if (input instanceof target) {
      return input;
    }
    if (descendsFrom(NominalRoot, target, input) || isVariantPair(NominalRoot, target, input)) {
      return constructOwn(target, Reflect.get(input, 'value'));
    }
  }
  const value = run(target, input);
  if (value instanceof Rejection) {
    return value;
  }
  remember(target, input, value);
  return new target(input);
};

/**
 * Internal: the instance `target` makes of `input`, or a `Rejection`, with nothing else allocated
 * on the way.
 *
 * @remarks
 * Returns an instance of the target as it is, and checks an instance of a related type by its
 * value. A type from another copy of the package goes through its own `parse`.
 */
export const construct = (target: AnyNominalType, input: unknown): unknown => {
  if (isOwnType(target)) {
    return constructOwn(target, input);
  }
  const parsed = target.parse(input);
  return parsed.ok ? parsed.value : new Rejection(parsed.issues);
};

const derive = (
  parent: typeof NominalRoot,
  name: string,
  rule: NominalSchema | undefined,
  base?: object,
): typeof NominalRoot => {
  const derived = class extends parent {
    public static override readonly typeName: string = name;
  };
  const key = Symbol.for(`${namespace}/${name}`);
  Object.defineProperty(derived, 'name', { value: name });
  Object.defineProperty(derived, brandKeySlot, { value: key });
  Object.defineProperty(derived, levelSlot, { value: base });
  Object.defineProperty(derived.prototype, key, { value: true });
  if (rule !== undefined) {
    Object.defineProperty(derived, 'rule', { value: rule });
  }
  return derived;
};

/**
 * Tells whether a value is a nominal type class, including one loaded from another copy of this
 * package.
 *
 * @remarks
 * Adapters use it to recognise a nominal type in metadata they receive, such as the parameter type
 * a framework reflects from a decorator.
 */
export const isNominalType = (value: unknown): value is AnyNominalType =>
  typeof value === 'function' &&
  value !== NominalRoot &&
  Reflect.get(Reflect.get(value, '~standard') ?? {}, 'vendor') === namespace;

/**
 * Declares a nominal type: a class whose instances exist only for values the schema accepts.
 *
 * @remarks
 * Extend the result to add behaviour. The name brands the type at compile time and identifies it
 * at runtime across ESM and CommonJS copies of this package, so it has to be unique among the
 * nominal types one application loads. A subclass that overrides `rule` stays the same type;
 * `subtype` makes a distinct one. A regular expression stands for `matching(pattern)`.
 *
 * @example
 * ```ts
 * export class OrderNumber extends Nominal('OrderNumber', /^ORD-\d{8}$/u) {
 *   get sequence(): number {
 *     return Number(this.value.slice(4));
 *   }
 * }
 * ```
 */
export function Nominal<const Name extends string>(
  name: Name,
  pattern: RegExp,
): NominalType<Name, NominalSchema<string, string>>;
export function Nominal<const Name extends string, Schema extends NominalSchema>(
  name: Name,
  schema: Schema,
): NominalType<Name, NominalSchema<InputOf<Schema>, ValueOf<Schema>>>;
export function Nominal(
  name: string,
  schema: NominalSchema | RegExp,
): typeof NominalRoot | AnyNominalType {
  return derive(NominalRoot, name, toSchema(schema));
}
