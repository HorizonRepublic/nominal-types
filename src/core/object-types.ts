import type { ConstraintField, ConstraintInput, ConstraintValue } from './constraint-types.ts';

/**
 * The fields of an object schema: each key to a nominal type, a `n.of()` or `n.object()`
 * schema, or any synchronous Standard Schema.
 */
export type ObjectFields = Readonly<Record<string, ConstraintField>>;

/**
 * What an object schema read from strings accepts: each field's input, or a string, any of them
 * possibly missing, as in `process.env`; the schema reports the ones it needs.
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
 * Internal: the field names of an object schema's value, as its methods take them.
 */
export type FieldKey<Shape> = Extract<keyof Shape, string>;

/**
 * Internal: an object input with every field, or the fields `Key`, allowed to be missing or
 * `undefined`, as `partial()` takes it.
 */
export type Loosened<Shape, Key extends PropertyKey = keyof Shape> = Simplify<
  Omit<Shape, Key> & Undefinable<Partial<Pick<Shape, Extract<keyof Shape, Key>>>>
>;

/**
 * Internal: an object value with every field, or the fields `Key`, allowed to be missing, as
 * `partial()` gives it.
 */
export type LoosenedValue<Shape, Key extends PropertyKey = keyof Shape> = Simplify<
  Omit<Shape, Key> & Partial<Pick<Shape, Extract<keyof Shape, Key>>>
>;

/**
 * Internal: an object type with every field, or the fields `Key`, required, as `required()`
 * gives it.
 */
export type Tightened<Shape, Key extends PropertyKey = keyof Shape> = Simplify<
  Omit<Shape, Key> & Defined<Required<Pick<Shape, Extract<keyof Shape, Key>>>>
>;

/**
 * Internal: an object type with only the fields `Key`, as `pick()` gives it.
 */
export type Picked<Shape, Key extends PropertyKey> = Simplify<
  Pick<Shape, Extract<keyof Shape, Key>>
>;

/**
 * Internal: an object type without the fields `Key`, as `omit()` gives it.
 */
export type Omitted<Shape, Key extends PropertyKey> = Simplify<Omit<Shape, Key>>;

/**
 * Internal: an object type with the fields of `Added`, replacing those of the same name, as
 * `extend()` gives it.
 */
export type Extended<Shape, Added> = Simplify<Omit<Shape, keyof Added> & Added>;
