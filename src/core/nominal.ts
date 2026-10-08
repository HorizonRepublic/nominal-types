// The root class keeps every decision about its instances in this one file, since they read its
// private field; that makes the file longer than the usual limit.
/* oxlint-disable max-lines */
import { brandCheck } from './compile.ts';
import type {
  AnyNominalType,
  ObjectInstance,
  ObjectRule,
  InputOf,
  NominalOptions,
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
  sensitiveSlot,
  variantSourceSlot,
} from './hierarchy.ts';
import { defineInspect } from './inspect.ts';
import { jsonText } from './messages.ts';
import { NominalError } from './nominal-error.ts';
import { checkObjectRule, defineObjectMembers, objectKeysOf } from './object-members.ts';
import { asRule } from './pattern-schema.ts';
import { nothingPending, takePending } from './pending.ts';
import { registerType } from './registry.ts';
import { Rejection } from './rejection.ts';
import { equalityKeySlot, inOneLine, noKey, sameValue } from './same-value.ts';
import type { EqualityKey } from './same-value.ts';
import { standardProps, vendor } from './standard-props.ts';
import type { StandardProps } from './standard-props.ts';
import { describeType, rulesAcceptsOf, rulesRunnerOf, runType } from './type-rules.ts';
import { parserFor } from './value-parser.ts';

const standardPropsOf = new WeakMap<object, StandardProps<unknown, NominalRoot>>();

let isTrusted: (target: typeof NominalRoot, instance: object) => boolean;

class NominalRoot {
  public static readonly typeName: string = 'Nominal';
  declare public static readonly rule: NominalSchema;
  public readonly value: unknown;
  readonly #checked: unknown;

  public constructor(input: unknown) {
    const target = new.target;
    const pending = takePending(target, input);
    const value = pending === nothingPending ? runType(NominalRoot, target, input) : pending;

    if (value instanceof Rejection) {
      throw new NominalError(target.typeName, value.issues);
    }

    this.value = value;
    this.#checked = value;
  }

  // Trusted: built by this copy, of the target or below it, still holding the value it was built with.
  static {
    isTrusted = (target, instance) =>
      #checked in instance &&
      Object.is(instance.#checked, instance.value) &&
      (Object.getPrototypeOf(instance) === target.prototype ||
        Object.prototype.isPrototypeOf.call(target.prototype, instance));
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

  public static parse(this: typeof NominalRoot, input: unknown): Parsed<NominalRoot> {
    const result = constructOwn(this, input);

    return result instanceof Rejection
      ? { ok: false, issues: result.issues }
      : { ok: true, value: result };
  }

  public static accepts(this: typeof NominalRoot, input: unknown): boolean {
    return acceptsOwn(this, input);
  }

  public static subtype(
    this: typeof NominalRoot,
    name: string,
    constraint?: NominalSchema | RegExp,
    options?: NominalOptions,
  ): typeof NominalRoot {
    checkObjectRule('subtype', this, constraint);

    const rule = constraint === undefined ? undefined : asRule(constraint);

    return derive(this, name, rule, this, options);
  }

  public static variant(
    this: typeof NominalRoot,
    name: string,
    rule: NominalSchema | RegExp,
    options?: NominalOptions,
  ): typeof NominalRoot {
    checkObjectRule('variant', this, rule);

    const level = levelOf(NominalRoot, this);
    const derived = derive(this, name, asRule(rule), level.base, options);

    for (const key of level.keys) {
      Object.defineProperty(derived.prototype, key, { value: false });
    }

    Object.defineProperty(derived, variantSourceSlot, { value: level.keys });

    return derived;
  }

  public equals(other: unknown): boolean {
    return inOneLine(this, other) && sameValue(Reflect.get(other, 'value'), this.value);
  }

  public toJSON(): unknown {
    return this.value;
  }

  public toString(): string {
    return typeof this.value === 'object' && this.value !== null
      ? jsonText(this)
      : String(this.value);
  }

  public [Symbol.toPrimitive](hint: string): unknown {
    if (hint === 'string') {
      return this.toString();
    }

    if (typeof this.value !== 'object' || this.value === null) {
      return this.value;
    }

    throw new TypeError(
      `${String(Reflect.get(this.constructor, 'typeName'))} holds an object and has no primitive value; compare its fields through .value`,
    );
  }
}

const rootEqualityKey: EqualityKey = {
  equals: Reflect.get(NominalRoot.prototype, 'equals'),
  key: ({ value }) => (typeof value === 'object' && value !== null ? noKey : value),
};

Object.defineProperty(NominalRoot.prototype, equalityKeySlot, { value: rootEqualityKey });
defineInspect(NominalRoot.prototype);

const isOwnType = (value: unknown): value is typeof NominalRoot =>
  typeof value === 'function' && Object.prototype.isPrototypeOf.call(NominalRoot, value);

type Type = typeof NominalRoot;
type ValueParser = (input: unknown) => NominalRoot | Rejection;

const valueParsers = new WeakMap<object, ValueParser>();

const valueParserOf = (target: Type): ValueParser => {
  let parser = valueParsers.get(target);

  if (parser === undefined) {
    parser = parserFor(target, rulesRunnerOf(NominalRoot, target));
    valueParsers.set(target, parser);
  }

  return parser;
};

const constructOwn = (target: Type, input: unknown): NominalRoot | Rejection =>
  typeof input === 'object' && input !== null
    ? constructFromObject(target, input)
    : valueParserOf(target)(input);

const constructFromObject = (target: Type, input: object): NominalRoot | Rejection => {
  if (input instanceof target) {
    return isTrusted(target, input) ? input : valueParserOf(target)(Reflect.get(input, 'value'));
  }

  return descendsFrom(NominalRoot, target, input) || isVariantPair(NominalRoot, target, input)
    ? constructOwn(target, Reflect.get(input, 'value'))
    : valueParserOf(target)(input);
};

// The decisions of `constructOwn`, without building anything.
const acceptsOwn = (target: Type, input: unknown): boolean => {
  if (typeof input !== 'object' || input === null) {
    return rulesAcceptsOf(NominalRoot, target)(input);
  }

  if (input instanceof target) {
    return (
      isTrusted(target, input) || rulesAcceptsOf(NominalRoot, target)(Reflect.get(input, 'value'))
    );
  }

  return descendsFrom(NominalRoot, target, input) || isVariantPair(NominalRoot, target, input)
    ? acceptsOwn(target, Reflect.get(input, 'value'))
    : rulesAcceptsOf(NominalRoot, target)(input);
};

/**
 * Internal: the parts of this module the type functions build on, for `type-functions.ts`.
 */
export const ownTypes: {
  readonly root: Type;
  readonly isOwn: (value: unknown) => value is Type;
  readonly construct: (target: Type, input: unknown) => NominalRoot | Rejection;
  readonly parserOf: (target: Type) => ValueParser;
} = { root: NominalRoot, isOwn: isOwnType, construct: constructOwn, parserOf: valueParserOf };

const derive = (
  parent: typeof NominalRoot,
  name: string,
  rule: NominalSchema | undefined,
  base: object | undefined,
  options: NominalOptions | undefined,
): typeof NominalRoot => {
  const derived = class extends parent {
    public static override readonly typeName: string = name;
  };
  const key = Symbol.for(`${vendor}/${name}`);

  Object.defineProperty(derived, 'name', { value: name });
  Object.defineProperty(derived, brandKeySlot, { value: key });
  Object.defineProperty(derived, levelSlot, { value: base });
  Object.defineProperty(derived.prototype, key, { value: true });
  Object.defineProperty(derived, Symbol.hasInstance, { value: brandCheck(key) });

  if (options?.sensitive !== undefined) {
    Object.defineProperty(derived, sensitiveSlot, { value: options.sensitive });
  }

  if (rule !== undefined) {
    Object.defineProperty(derived, 'rule', { value: rule });

    const keys = objectKeysOf(rule);

    if (keys !== undefined) {
      defineObjectMembers(derived.prototype, keys);
    }
  }

  registerType(name, derived, { parent: parent.typeName, base: base === parent, rule });

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
 * Declares a nominal type: a class whose instances exist only for values the schema accepts.
 *
 * @remarks
 * Extend the result to add behaviour. The name brands the type at compile time and identifies it
 * at runtime across ESM and CommonJS copies of this package, so it has to be unique among the
 * nominal types one application loads. A subclass that overrides `rule` stays the same type;
 * `subtype` makes a distinct one. A regular expression stands for `n.matching(pattern)`.
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
  options?: NominalOptions,
): NominalType<Name, NominalSchema<string, string>>;
export function Nominal<const Name extends string, Input, Value extends object>(
  name: Name,
  schema: ObjectRule<Input, Value>,
  options?: NominalOptions,
): NominalType<Name, NominalSchema<Input, Value>, ObjectInstance<Name, Input, Value>>;
export function Nominal<const Name extends string, Schema extends NominalSchema>(
  name: Name,
  schema: Schema,
  options?: NominalOptions,
): NominalType<Name, NominalSchema<InputOf<Schema>, ValueOf<Schema>>>;
export function Nominal(
  name: string,
  schema: NominalSchema | RegExp,
  options?: NominalOptions,
): typeof NominalRoot | AnyNominalType {
  return derive(NominalRoot, name, asRule(schema), undefined, options);
}
