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
  variantSourceSlot,
} from './hierarchy.ts';
import { NominalError } from './nominal-error.ts';
import { PatternSchema } from './pattern-schema.ts';
import { remember, nothingPending, takePending } from './pending.ts';
import { registerType, typeNamed } from './registry.ts';
import { Rejection } from './rejection.ts';
import { sameValue } from './same-value.ts';
import { standardProps, vendor } from './standard-props.ts';
import type { StandardProps } from './standard-schema.ts';
import { describeType, runType } from './type-rules.ts';

const standardPropsOf = new WeakMap<object, StandardProps<unknown, NominalRoot>>();

const toSchema = (schema: NominalSchema | RegExp): NominalSchema =>
  schema instanceof RegExp ? new PatternSchema(schema) : schema;

class NominalRoot {
  public static readonly typeName: string = 'Nominal';
  declare public static readonly rule: NominalSchema;
  public readonly value: unknown;

  public constructor(input: unknown) {
    const target = new.target;
    const pending = takePending(target, input);
    if (pending !== nothingPending) {
      this.value = pending;
      return;
    }
    const value = runType(NominalRoot, target, input);
    if (value instanceof Rejection) {
      throw new NominalError(target.typeName, value.issues);
    }
    this.value = value;
  }

  public static get '~standard'(): StandardProps<unknown, NominalRoot> {
    const cached = standardPropsOf.get(this);
    if (cached !== undefined) {
      return cached;
    }
    const props = standardProps<unknown, NominalRoot>(
      (input) => constructOwn(this, input),
      (side, options) => describeType(NominalRoot, this, side, options),
    );
    standardPropsOf.set(this, props);
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
  const value = runType(NominalRoot, target, input);
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
  const key = Symbol.for(`${vendor}/${name}`);
  Object.defineProperty(derived, 'name', { value: name });
  Object.defineProperty(derived, brandKeySlot, { value: key });
  Object.defineProperty(derived, levelSlot, { value: base });
  Object.defineProperty(derived.prototype, key, { value: true });
  if (rule !== undefined) {
    Object.defineProperty(derived, 'rule', { value: rule });
  }
  registerType(name, derived);
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
  Reflect.get(Reflect.get(value, '~standard') ?? {}, 'vendor') === vendor;

/**
 * Internal: finds a nominal type by the name it was declared with, for adapters that only see names, such
 * as an OpenAPI document whose schemas are named after classes.
 *
 * @remarks
 * Only types declared through this copy of the package are found. A class that merely extends a
 * type shares its name and is found as that type.
 */
export const nominalTypeNamed = (name: string): AnyNominalType | undefined => {
  const type = typeNamed(name);
  return isNominalType(type) ? type : undefined;
};

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
