import type { AnyConstraint } from './constraint-types.ts';
import type { SubtypeOf, VariantOf } from './derived-types.ts';
import type { StandardProps } from './standard-schema.ts';
import type { StandardJSONSchemaV1, StandardSchemaV1 } from './standard-spec.ts';

declare const brand: unique symbol;

/**
 * The phantom marker that keeps two nominal types apart even when they wrap the same value.
 *
 * @remarks
 * Each name becomes a key, so a subtype carries its own key and every key of the type it
 * extends: it is assignable to its parent, while the parent is not assignable to it.
 */
export type Brand<Name extends string> = Readonly<Record<Name, true>>;

/**
 * The phantom part of an instance that holds its brand, as a named type, so declaration files can
 * spell out the instance of a type declared without a class of its own.
 */
export interface Branded<Names> {
  readonly [brand]: Names;
}

/**
 * The schema a nominal type validates with: any Standard Schema whose `validate` answers
 * synchronously.
 *
 * @remarks
 * A schema that also carries a Standard JSON Schema converter lets the nominal type describe
 * itself to OpenAPI and documentation generators.
 */
export interface NominalSchema<Input = unknown, Value = unknown> {
  readonly '~standard': StandardSchemaV1.Props<Input, Value> & {
    readonly jsonSchema?: StandardJSONSchemaV1.Converter | undefined;
  };
}

/**
 * The input type a schema accepts.
 */
export type InputOf<Schema extends NominalSchema> = NonNullable<
  Schema['~standard']['types']
>['input'];

/**
 * The value type a schema produces.
 */
export type ValueOf<Schema extends NominalSchema> = NonNullable<
  Schema['~standard']['types']
>['output'];

/**
 * The outcome of `parse`: the constructed instance, or the issues that prevented it.
 */
export type Parsed<Instance> =
  | { readonly ok: true; readonly value: Instance }
  | { readonly ok: false; readonly issues: readonly StandardSchemaV1.Issue[] };

/**
 * A value as a nominal type holds it: plain objects and arrays read-only all the way down, nominal
 * instances, primitives and functions as they are.
 *
 * @remarks
 * The runtime matches it: an object value is frozen when the instance is built.
 */
export type Immutable<Value> = unknown extends Value
  ? Value
  : Value extends
        | NominalInstance<string, unknown>
        | string
        | number
        | bigint
        | boolean
        | symbol
        | null
        | undefined
        | ((...parameters: never[]) => unknown)
    ? Value
    : Value extends ReadonlyArray<infer Item>
      ? ReadonlyArray<Immutable<Item>>
      : { readonly [Key in keyof Value]: Immutable<Value[Key]> };

/**
 * What every nominal value offers, whatever type it belongs to.
 *
 * @remarks
 * An instance converts to its value where JavaScript asks for a primitive, so `end > start`, `n +
 * 1` and template strings work on the value. An instance holding an object converts to its JSON
 * text in a string and throws a `TypeError` anywhere else, since no single primitive stands for it.
 */
export interface NominalInstance<Name extends string, Value> {
  readonly [brand]: Brand<Name>;
  readonly value: Immutable<Value>;
  equals(other: unknown): boolean;
  toJSON(): unknown;
  toString(): string;
  [Symbol.toPrimitive](hint: string): Value extends object ? string : Value;
}

/**
 * What `Nominal()` needs to know of an `n.object()` schema to give the type its fields.
 */
export interface ObjectRule<Input, Value> extends NominalSchema<Input, Value> {
  readonly keys: readonly string[];
  strict(): ObjectRule<Input, Value>;
}

/**
 * An instance of a type built on `n.object()`: a getter for each field, and `copyWith()`, which
 * returns a checked copy with some fields changed.
 */
export type ObjectInstance<Name extends string, Input, Value> = NominalInstance<Name, Value> &
  Value &
  ObjectCopy<Input>;

/**
 * The copy method of an instance of a type built on `n.object()`.
 */
export interface ObjectCopy<Input> {
  /**
   * A new instance with these fields changed and the others kept, checked like `new`.
   *
   * @remarks
   * The copy is built with `new` on the instance's own class, given the whole changed object, so
   * a class with a constructor of its own has to take that object as its first argument.
   *
   * @throws NominalError when the changed value breaks a rule, or a key is not a field of the
   * object (`is not allowed`).
   */
  copyWith(changes: Partial<Input>): this;
}

/**
 * Options for `Nominal()`, `subtype()` and `variant()`.
 */
export interface NominalOptions<Implied extends AnyNominalType = AnyNominalType> {
  /**
   * Leaves the rejected value out of the type's messages, for values such as passwords or personal
   * data: `must be an email address (was a string of 12 characters)`. Subtypes and variants
   * inherit it; `false` turns it off for one of them.
   */
  readonly sensitive?: boolean;
  /** `false` keeps a string type's input as given, whatever `n.configure()` normalizes. */
  readonly normalize?: boolean;
  /**
   * Types that accept every value this type accepts, so its instances pass for theirs as well:
   * at compile time, and for `instanceof` and `equals()`.
   *
   * @remarks
   * The declaration is trusted, never checked against values, so list a type only when each
   * value of the new type passes it. `parse()` of an implied type still checks the value and
   * returns an instance of its own. The new type also carries what the listed types imply. A type
   * with members the new type lacks can't be listed.
   *
   * @example
   * ```ts
   * class Stars extends Uint8.subtype('review.Stars', oneToFive, { implies: [PositiveInteger] }) {}
   *
   * new Stars(4) instanceof PositiveInteger; // true
   * ```
   */
  readonly implies?: readonly Implied[];
}

/**
 * Any nominal type class, for code that accepts nominal types generically, such as adapters.
 */
export interface AnyNominalType {
  readonly prototype: NominalInstance<string, unknown>;
  readonly typeName: string;
  readonly rule: NominalSchema;
  readonly '~standard': StandardProps<unknown, NominalInstance<string, unknown>>;
  parse<Type extends AnyNominalType>(this: Type, input: unknown): Parsed<Type['prototype']>;
  /**
   * The instance, or a Promise rejected with a `NominalError`, for libraries that await a parser
   * and expect it to throw, such as tRPC.
   *
   * @remarks
   * tRPC calls a schema's `parseAsync()` before its `parse()`, so `.input(Email)` refuses a bad
   * value with `BAD_REQUEST`. In your own code, read the result of `parse()`, which builds no
   * exception.
   *
   * @example
   * ```ts
   * await Email.parseAsync('jane'); // rejects: NominalError: nominal.Email: must be an email address (was a string of 4 characters)
   * ```
   */
  parseAsync<Type extends AnyNominalType>(this: Type, input: unknown): Promise<Type['prototype']>;
  /**
   * Whether `parse` would accept the input, answered without building an instance or issues: for
   * a cheap yes or no, such as a filter or a branch on the kind of input.
   *
   * @remarks
   * It runs the type's rules, and treats instances as `parse` does. A constructor of your own is
   * not run, so a class whose constructor changes or refuses the input can disagree with `parse`.
   * It doesn't narrow the input: a string it accepts is still a string, not an instance.
   *
   * @example
   * ```ts
   * Integer.accepts(42); // true
   * Integer.accepts(4.2); // false
   * ```
   */
  accepts(input: unknown): boolean;
  /**
   * The JSON text of an instance, what `JSON.stringify()` writes for it, for a response that is one
   * value of this type.
   *
   * @remarks
   * A type built on `n.object()` writes its fields straight to text with the object schema's
   * `stringify()`, in the order they were declared, several times faster. Any other type, an
   * instance whose `value` was changed and a value of another type go through `JSON.stringify()`.
   *
   * @throws TypeError for a value JSON has no text for, such as `undefined`.
   *
   * @example
   * ```ts
   * Uuid.stringify(new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f')); // '"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"'
   * ```
   */
  stringify<Type extends AnyNominalType>(this: Type, value: Type['prototype']): string;
}

/**
 * A nominal type class: construct it with `new`, which validates, or go through `parse`
 * where bad input is expected.
 *
 * @remarks
 * The class is a Standard Schema and a Standard JSON Schema through its static `~standard`, so
 * consumers that call `~standard` accept the class itself. Consumers that parse definitions treat
 * any function as their own construct, and take the plain object `n.of(Type)` returns instead.
 */
export interface NominalType<
  Name extends string,
  Schema extends NominalSchema,
  Instance extends NominalInstance<Name, ValueOf<Schema>> = NominalInstance<Name, ValueOf<Schema>>,
> extends AnyNominalType {
  new (input: InputOf<Schema>): Instance;
  readonly prototype: Instance;
  readonly typeName: Name;
  readonly rule: Schema;
  readonly '~standard': StandardProps<InputOf<Schema>, Instance>;
  subtype<
    Type extends AnyNominalType,
    const SubtypeName extends string,
    Value extends ValueOf<Type['rule']> = ValueOf<Type['rule']>,
    Implied extends AnyNominalType = never,
  >(
    this: Type,
    name: SubtypeName,
    constraint?:
      | NominalSchema<ValueOf<Type['rule']>, Value>
      | (ValueOf<Type['rule']> extends string ? RegExp : never)
      | (ValueOf<Type['rule']> extends object ? AnyConstraint & NominalSchema : never),
    options?: NominalOptions<Implied>,
  ): SubtypeOf<Type, SubtypeName, Value, Implied>;
  variant<
    Type extends AnyNominalType,
    const VariantName extends string,
    Implied extends AnyNominalType = never,
  >(
    this: Type,
    name: VariantName,
    rule:
      | NominalSchema<ValueOf<Type['rule']>, ValueOf<Type['rule']>>
      | (ValueOf<Type['rule']> extends string ? RegExp : never)
      | (ValueOf<Type['rule']> extends object ? AnyConstraint & NominalSchema : never),
    options?: NominalOptions<Implied>,
  ): VariantOf<Type, VariantName, Implied>;
}

/**
 * An instance whose value a rule narrowed, such as `n.oneOf()` under `AnyString`, typed with the
 * narrower value.
 */
export type Narrowed<Instance extends NominalInstance<string, unknown>, Value> = [
  Instance['value'],
] extends [Immutable<Value>]
  ? Instance
  : Instance & { readonly value: Immutable<Value> };

/**
 * An instance without its brand, named so declaration files can spell out a variant.
 */
export type Unbranded<Instance> = Omit<Instance, typeof brand>;

/**
 * The brand names an instance carries, named so declaration files can spell out a variant.
 */
export type BrandsOf<Instance extends Branded<unknown>> = Instance[typeof brand];

export type {
  ImplyingType,
  SubtypeInstance,
  SubtypeOf,
  VariantInstance,
  VariantOf,
} from './derived-types.ts';
