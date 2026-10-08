import type { ConstraintField, ConstraintInput, ConstraintValue } from './constraint-types.ts';

/**
 * The fields of an object schema: each key to a nominal type, a `n.of()` or `n.object()`
 * schema, or any synchronous Standard Schema.
 */
export type ObjectFields = Readonly<Record<string, ConstraintField>>;

/**
 * What an object schema read from strings accepts: each field's input, or a string, any of them
 * possibly missing, as in `process.env`; the schema reports the ones it needs.
 *
 * @typeParam Input - What the object schema accepts before it reads from strings.
 */
export type TextInput<Input> = {
  readonly [Key in keyof Input]?: Input[Key] | string | undefined;
};

type Simplify<Shape> = { [Key in keyof Shape]: Shape[Key] };

type OptionalKeys<Fields extends ObjectFields> = {
  [Key in keyof Fields]: undefined extends ConstraintInput<Fields[Key]> ? Key : never;
}[keyof Fields];

/**
 * What an object schema gives: the value of each field, the ones that may be missing optional.
 *
 * @typeParam Fields - The fields of the schema, each key to its type or schema.
 */
export type ObjectValue<Fields extends ObjectFields> = Simplify<
  {
    readonly [Key in Exclude<keyof Fields, OptionalKeys<Fields>>]: ConstraintValue<Fields[Key]>;
  } & {
    readonly [Key in OptionalKeys<Fields>]?: Exclude<ConstraintValue<Fields[Key]>, undefined>;
  }
>;

/**
 * What an object schema accepts: the input of each field, the ones that may be missing optional.
 *
 * @typeParam Fields - The fields of the schema, each key to its type or schema.
 */
export type ObjectInput<Fields extends ObjectFields> = Simplify<
  {
    readonly [Key in Exclude<keyof Fields, OptionalKeys<Fields>>]: ConstraintInput<Fields[Key]>;
  } & {
    readonly [Key in OptionalKeys<Fields>]?: ConstraintInput<Fields[Key]>;
  }
>;

type Undefinable<Shape> = { [Key in keyof Shape]: Shape[Key] | undefined };

type Defined<Shape> = { [Key in keyof Shape]: Exclude<Shape[Key], undefined> };

/**
 * The field names of an object schema's value, as its methods take them.
 *
 * @internal
 */
export type FieldKey<Shape> = Extract<keyof Shape, string>;

/**
 * An object input with every field, or the fields `Key`, allowed to be missing or
 * `undefined`, as `partial()` takes it.
 *
 * @internal
 */
export type Loosened<Shape, Key extends PropertyKey = keyof Shape> = Simplify<
  Omit<Shape, Key> & Undefinable<Partial<Pick<Shape, Extract<keyof Shape, Key>>>>
>;

/**
 * An object value with every field, or the fields `Key`, allowed to be missing, as
 * `partial()` gives it.
 *
 * @internal
 */
export type LoosenedValue<Shape, Key extends PropertyKey = keyof Shape> = Simplify<
  Omit<Shape, Key> & Partial<Pick<Shape, Extract<keyof Shape, Key>>>
>;

/**
 * An object type with every field, or the fields `Key`, required, as `required()`
 * gives it.
 *
 * @internal
 */
export type Tightened<Shape, Key extends PropertyKey = keyof Shape> = Simplify<
  Omit<Shape, Key> & Defined<Required<Pick<Shape, Extract<keyof Shape, Key>>>>
>;

/**
 * An object type with only the fields `Key`, as `pick()` gives it.
 *
 * @internal
 */
export type Picked<Shape, Key extends PropertyKey> = Simplify<
  Pick<Shape, Extract<keyof Shape, Key>>
>;

/**
 * An object type without the fields `Key`, as `omit()` gives it.
 *
 * @internal
 */
export type Omitted<Shape, Key extends PropertyKey> = Simplify<Omit<Shape, Key>>;

/**
 * An object type with the fields of `Added`, replacing those of the same name, as
 * `extend()` gives it.
 *
 * @internal
 */
export type Extended<Shape, Added> = Simplify<Omit<Shape, keyof Added> & Added>;
