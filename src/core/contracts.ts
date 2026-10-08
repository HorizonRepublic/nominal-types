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
 *
 * @typeParam Name - The type names the brand holds, as a union.
 */
export type Brand<Name extends string> = Readonly<Record<Name, true>>;

/**
 * The phantom part of an instance that holds its brand, as a named type, so declaration files can
 * spell out the instance of a type declared without a class of its own.
 *
 * @typeParam Names - The brand the instance carries, usually a {@link Brand}.
 */
export interface Branded<Names> {
  /**
   * The brand itself. It exists only at compile time: no instance has this property at runtime.
   */
  readonly [brand]: Names;
}

/**
 * The schema a nominal type validates with: any Standard Schema whose `validate` answers
 * synchronously.
 *
 * @remarks
 * A schema that also carries a Standard JSON Schema converter lets the nominal type describe
 * itself to OpenAPI and documentation generators.
 *
 * @typeParam Input - The type of the values the schema accepts.
 * @typeParam Value - The type of the value the schema gives back.
 */
export interface NominalSchema<Input = unknown, Value = unknown> {
  /**
   * The Standard Schema properties, with the optional JSON Schema converter.
   */
  readonly '~standard': StandardSchemaV1.Props<Input, Value> & {
    readonly jsonSchema?: StandardJSONSchemaV1.Converter | undefined;
  };
}

/**
 * The input type a schema accepts.
 *
 * @typeParam Schema - The schema to read the input type from.
 */
export type InputOf<Schema extends NominalSchema> = NonNullable<
  Schema['~standard']['types']
>['input'];

/**
 * The value type a schema produces.
 *
 * @typeParam Schema - The schema to read the value type from.
 */
export type ValueOf<Schema extends NominalSchema> = NonNullable<
  Schema['~standard']['types']
>['output'];

/**
 * The outcome of `parse`: the constructed instance, or the issues that prevented it.
 *
 * @remarks
 * Check `ok` first: it tells TypeScript which of the two shapes you hold.
 *
 * @typeParam Instance - The type of the value a successful parse gives.
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
 *
 * @typeParam Value - The value to make read-only.
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
 * An instance converts to its value where JavaScript asks for a primitive, so `end > start`,
 * `n + 1` and template strings work on the value. An instance holding an object converts to its
 * JSON text in a string and throws a `TypeError` anywhere else, since no single primitive stands
 * for it.
 *
 * @typeParam Name - The type name the instance is branded with.
 * @typeParam Value - The type of the value the instance holds.
 */
export interface NominalInstance<Name extends string, Value> {
  /**
   * The brand that keeps this type apart from others. It exists only at compile time.
   */
  readonly [brand]: Brand<Name>;
  /**
   * The value the instance holds. It passed every rule of the type when the instance was made.
   *
   * @remarks
   * An object or array value is frozen all the way down. An instance whose `value` was changed
   * is no longer trusted, and `parse()` checks it again.
   */
  readonly value: Immutable<Value>;
  /**
   * Whether another value is an instance of the same line of types that holds an equal value.
   *
   * @remarks
   * A type and its subtypes are one line, so an `Email` equals a `StaffEmail` with the same
   * value. Siblings and variants are not. Primitives are compared with `Object.is`, arrays item
   * by item and plain objects key by key.
   *
   * @param other - The value to compare with.
   * @returns `true` when both are of one line of types and hold equal values.
   *
   * @example
   * ```ts
   * import { Email } from '@horizon-republic/nominal-types';
   *
   * const email = new Email('jane@example.com');
   *
   * email.equals(new Email('jane@example.com')); // true
   * email.equals('jane@example.com'); // false
   * ```
   */
  equals(other: unknown): boolean;
  /**
   * What `JSON.stringify()` writes for the instance: its value.
   *
   * @remarks
   * `AnyBigInt` and the types under it return a decimal string. The date and time types return
   * their text.
   *
   * @returns The value in a form JSON can hold.
   */
  toJSON(): unknown;
  /**
   * The value as text: `String(value)`, or JSON text for an object or array value.
   *
   * @returns The text of the value.
   */
  toString(): string;
  /**
   * The value where JavaScript asks for a primitive, such as in `>`, `+`, `Number()` and
   * template strings.
   *
   * @param hint - What JavaScript asks for: `'string'`, `'number'` or `'default'`.
   * @returns The text of the value for a `'string'` hint, otherwise the value itself.
   * @throws {@link TypeError} if the instance holds an object and the hint is not `'string'`.
   */
  [Symbol.toPrimitive](hint: string): Value extends object ? string : Value;
}

/**
 * What `Nominal()` needs to know of an `n.object()` schema to give the type its fields.
 *
 * @typeParam Input - The type of the object the schema accepts.
 * @typeParam Value - The type of the object the schema gives back.
 */
export interface ObjectRule<Input, Value> extends NominalSchema<Input, Value> {
  /**
   * The names of the declared fields, in the order they were declared.
   */
  readonly keys: readonly string[];
  /**
   * The same schema, refusing keys it doesn't declare instead of dropping them.
   *
   * @returns A new schema that refuses unknown keys.
   */
  strict(): ObjectRule<Input, Value>;
}

/**
 * An instance of a type built on `n.object()`: a getter for each field, and `copyWith()`, which
 * returns a checked copy with some fields changed.
 *
 * @typeParam Name - The type name the instance is branded with.
 * @typeParam Input - The type of the object the type accepts.
 * @typeParam Value - The type of the object the instance holds.
 */
export type ObjectInstance<Name extends string, Input, Value> = NominalInstance<Name, Value> &
  Value &
  ObjectCopy<Input>;

/**
 * The copy method of an instance of a type built on `n.object()`.
 *
 * @typeParam Input - The type of the object the type accepts.
 */
export interface ObjectCopy<Input> {
  /**
   * A new instance with these fields changed and the others kept, checked like `new`.
   *
   * @remarks
   * The copy is built with `new` on the instance's own class, given the whole changed object, so
   * a class with a constructor of its own has to take that object as its first argument.
   *
   * @param changes - The fields to change, with their new values.
   * @returns A new instance of the same class.
   * @throws {@link NominalError} when the changed value breaks a rule, or a key is not a field of
   * the object (`is not allowed`).
   *
   * @example
   * ```ts
   * import { Email, n, Nominal } from '@horizon-republic/nominal-types';
   *
   * class Contact extends Nominal('crm.Contact', n.object({ email: Email })) {}
   *
   * const contact = new Contact({ email: 'jane@example.com' });
   * const moved = contact.copyWith({ email: 'jane@example.org' });
   * ```
   */
  copyWith(changes: Partial<Input>): this;
}

/**
 * Options for `Nominal()`, `subtype()` and `variant()`.
 *
 * @typeParam Implied - The types listed in `implies`.
 */
export interface NominalOptions<Implied extends AnyNominalType = AnyNominalType> {
  /**
   * Leaves the rejected value out of the type's messages, for values such as passwords or personal
   * data: `must be an email address (was a string of 12 characters)`. Subtypes and variants
   * inherit it; `false` turns it off for one of them.
   *
   * @defaultValue `false` for `Nominal()`, and the parent's setting for `subtype()` and
   * `variant()`.
   */
  readonly sensitive?: boolean;
  /**
   * `false` keeps a string type's input as given, whatever `n.configure()` normalizes.
   *
   * @defaultValue `true` for `Nominal()`, and the parent's setting for `subtype()` and
   * `variant()`.
   */
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
   * @defaultValue `[]`
   *
   * @example
   * ```ts
   * import { n, PositiveInteger, Uint8 } from '@horizon-republic/nominal-types';
   *
   * const oneToFive = n.satisfying(
   *   (value: unknown): value is number => typeof value === 'number' && value >= 1 && value <= 5,
   *   'a rating from 1 to 5',
   * );
   *
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
  /**
   * The prototype of the instances, which carries their type.
   */
  readonly prototype: NominalInstance<string, unknown>;
  /**
   * The name the type was declared with, such as `billing.InvoiceNumber`.
   *
   * @remarks
   * It brands the type, starts its error messages, and names its schema in OpenAPI.
   */
  readonly typeName: string;
  /**
   * The rule the type's own level adds, checked after the rules of the types above it.
   */
  readonly rule: NominalSchema;
  /**
   * The Standard Schema and Standard JSON Schema properties, which let libraries such as tRPC,
   * Hono and OpenAPI generators use the class as a schema.
   */
  readonly '~standard': StandardProps<unknown, NominalInstance<string, unknown>>;
  /**
   * Checks a value without throwing: the instance, or the issues that prevented it.
   *
   * @remarks
   * Reach for it where bad input is expected, such as a request body. An instance of this type
   * passes as it is. An instance of a type above it, or of a variant, is checked again by its
   * value.
   *
   * @typeParam Type - The class `parse` is called on.
   * @param input - The value to check.
   * @returns `{ ok: true, value }` with the instance, or `{ ok: false, issues }`.
   *
   * @example
   * ```ts
   * import { Email } from '@horizon-republic/nominal-types';
   *
   * declare const input: unknown;
   *
   * const result = Email.parse(input);
   *
   * if (result.ok) {
   *   result.value.domain; // 'example.com'
   * }
   * ```
   */
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
   * @typeParam Type - The class `parseAsync` is called on.
   * @param input - The value to check.
   * @returns A Promise of the instance, rejected with a {@link NominalError} for a bad value.
   *
   * @example
   * ```ts
   * import { Email } from '@horizon-republic/nominal-types';
   *
   * await Email.parseAsync('jane');
   * // rejects: NominalError: nominal.Email: must be an email address (was a string of 4 characters)
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
   * @param input - The value to check.
   * @returns `true` when `parse` would accept the input.
   *
   * @example
   * ```ts
   * import { Integer } from '@horizon-republic/nominal-types';
   *
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
   * @typeParam Type - The class `stringify` is called on.
   * @param value - The instance to write.
   * @returns The JSON text.
   * @throws {@link TypeError} when JSON has no text for the value, such as `undefined`.
   *
   * @example
   * ```ts
   * import { Uuid } from '@horizon-republic/nominal-types';
   *
   * const id = new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');
   *
   * Uuid.stringify(id); // '"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"'
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
 *
 * @typeParam Name - The type name.
 * @typeParam Schema - The rule of the type's own level.
 * @typeParam Instance - The type of its instances.
 *
 * @see {@link Nominal}
 */
export interface NominalType<
  Name extends string,
  Schema extends NominalSchema,
  Instance extends NominalInstance<Name, ValueOf<Schema>> = NominalInstance<Name, ValueOf<Schema>>,
> extends AnyNominalType {
  /**
   * Checks the input and makes an instance that holds it.
   *
   * @param input - The value to check.
   * @throws {@link NominalError} when the input breaks a rule of the type.
   */
  new (input: InputOf<Schema>): Instance;
  /**
   * The prototype of the instances, which carries their type.
   */
  readonly prototype: Instance;
  /**
   * The name the type was declared with, such as `billing.InvoiceNumber`.
   */
  readonly typeName: Name;
  /**
   * The rule the type's own level adds, checked after the rules of the types above it.
   */
  readonly rule: Schema;
  /**
   * The Standard Schema and Standard JSON Schema properties, typed with this class's instances.
   */
  readonly '~standard': StandardProps<InputOf<Schema>, Instance>;
  /**
   * Declares a narrower type under this one: it checks this type's rules, then a rule of its own,
   * and its instances pass wherever this type's are expected.
   *
   * @remarks
   * Without a rule, the subtype accepts the same values and is still a type of its own. A rule
   * that allows fewer values, such as `n.oneOf()`, also narrows the type of `value`. A regular
   * expression stands for `n.matching(pattern)` and fits a type whose value is a string.
   *
   * @typeParam Type - The class `subtype` is called on.
   * @typeParam SubtypeName - The name of the new type.
   * @typeParam Value - The value type the rule narrows to.
   * @typeParam Implied - The types listed in `options.implies`.
   * @param name - The type name of the new type, such as `shop.StaffEmail`.
   * @param constraint - The rule the new type adds, or `undefined` for none.
   * @param options - Settings for the new type.
   * @returns A class to extend.
   * @throws {@link TypeError} when the name is not a valid type name, a regular expression has a
   * flag other than `u`, or `options.implies` lists something that can't be implied.
   *
   * @example
   * ```ts
   * import { Email } from '@horizon-republic/nominal-types';
   *
   * class StaffEmail extends Email.subtype('shop.StaffEmail', /example\.com$/u) {}
   *
   * new StaffEmail('jane@example.com') instanceof Email; // true
   * ```
   */
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
  /**
   * Declares a sibling of this type: the same methods, with a rule of its own in place of this
   * type's rule.
   *
   * @remarks
   * The variant checks the rules of the types above this one, then its own rule. It and this type
   * don't pass for each other; both pass for the type above. A method written for this type's
   * values may give wrong results for the variant's.
   *
   * @typeParam Type - The class `variant` is called on.
   * @typeParam VariantName - The name of the new type.
   * @typeParam Implied - The types listed in `options.implies`.
   * @param name - The type name of the new type, such as `shop.LegacySku`.
   * @param rule - The rule used in place of this type's rule.
   * @param options - Settings for the new type.
   * @returns A class to extend.
   * @throws {@link TypeError} when the name is not a valid type name, a regular expression has a
   * flag other than `u`, or `options.implies` lists something that can't be implied.
   *
   * @example
   * ```ts
   * import { AnyString, n } from '@horizon-republic/nominal-types';
   *
   * const legacyRule = n.matching(/^[A-Z]{3}\d{6}$/u, 'a legacy SKU');
   *
   * class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}
   * class LegacySku extends Sku.variant('shop.LegacySku', legacyRule) {}
   *
   * new LegacySku('ABC123456') instanceof Sku; // false
   * ```
   */
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
 *
 * @typeParam Instance - The instance before narrowing.
 * @typeParam Value - The narrower value type.
 */
export type Narrowed<Instance extends NominalInstance<string, unknown>, Value> = [
  Instance['value'],
] extends [Immutable<Value>]
  ? Instance
  : Instance & { readonly value: Immutable<Value> };

/**
 * An instance without its brand, named so declaration files can spell out a variant.
 *
 * @typeParam Instance - The instance to drop the brand from.
 */
export type Unbranded<Instance> = Omit<Instance, typeof brand>;

/**
 * The brand names an instance carries, named so declaration files can spell out a variant.
 *
 * @typeParam Instance - The instance to read the brand from.
 */
export type BrandsOf<Instance extends Branded<unknown>> = Instance[typeof brand];

export type {
  ImplyingType,
  SubtypeInstance,
  SubtypeOf,
  VariantInstance,
  VariantOf,
} from './derived-types.ts';
