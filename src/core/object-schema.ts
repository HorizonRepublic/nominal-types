import type {
  AnyConstraint,
  ConstraintField,
  ConstraintInput,
  ConstraintValue,
} from './constraint-types.ts';
import { describeField } from './field-json.ts';
import { foreignRunner } from './foreign-runner.ts';
import { isNominalType } from './nominal.ts';
import { objectMark } from './object-members.ts';
import { objectShape } from './object-shape.ts';
import type { ObjectField } from './object-shape.ts';
import { Rejection } from './rejection.ts';
import { instanceParserFor } from './type-functions.ts';
import { TypeSchema } from './type-schema.ts';

/**
 * The fields of an object schema: each key to a nominal type, a `schemaOf()` or `objectOf()`
 * schema, or any synchronous Standard Schema.
 */
export type ObjectFields = Readonly<Record<string, ConstraintField>>;

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

const runnerOf = (field: ConstraintField): ((value?: unknown) => unknown) =>
  isNominalType(field) ? instanceParserFor(field) : foreignRunner(field, 'objectOf()');

const fieldsOf = (fields: ObjectFields): ObjectField[] =>
  Object.entries(fields).map(([key, field]) => {
    if (key === '__proto__') {
      throw new TypeError('objectOf(): a field cannot be named __proto__');
    }

    const run = runnerOf(field);

    return {
      key,
      run,
      optional: !(run() instanceof Rejection),
      describe: (side, options) => describeField(field, side, options, 'object'),
    };
  });

/**
 * An object made of fields, each checked by its own schema: what `objectOf()` returns.
 *
 * @remarks
 * It is a `TypeSchema`, so `array()`, `optional()` and `nullable()` build on it, and a nominal type
 * takes it as its rule.
 */
export class ObjectSchema<Input, Output> extends TypeSchema<Input, Output> {
  /**
   * The names of the fields, in the order they were declared.
   */
  public readonly keys: readonly string[];
  readonly #fields: readonly ObjectField[];
  readonly #constraints: readonly AnyConstraint[];

  /**
   * Internal: built by `objectOf()` and `strict()`.
   */
  public constructor(
    fields: readonly ObjectField[],
    constraints: readonly AnyConstraint[],
    strict: boolean,
  ) {
    // The shape returns a new object of the fields, which is what Output describes.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    super(objectShape(fields, constraints, strict) as never);
    this.keys = fields.map(({ key }) => key);
    this.#fields = fields;
    this.#constraints = constraints;
    Object.defineProperty(this, objectMark, { value: true });
  }

  /**
   * This schema, refusing keys it doesn't declare instead of dropping them.
   */
  public strict(): ObjectSchema<Input, Output> {
    return new ObjectSchema(this.#fields, this.#constraints, true);
  }
}

/**
 * Whether a value is a schema built by `objectOf()`, also by another copy of this package.
 */
export const isObjectSchema = (value: unknown): value is ObjectSchema<unknown, unknown> =>
  typeof value === 'object' && value !== null && Reflect.get(value, objectMark) === true;

/**
 * Builds a schema for an object whose fields are nominal types, for a request body, a message or
 * a value object made of several fields.
 *
 * @remarks
 * Every field is checked and every issue collected, with the field's key in its path. Keys the
 * schema doesn't declare are dropped; call `strict()` to refuse them. A field whose schema accepts
 * `undefined`, such as `schemaOf(Type).optional()`, may be missing. The constraints run once every
 * field is valid. The result is a new object, read-only by type; given to `Nominal()`, it is
 * frozen.
 *
 * Given to `Nominal()`, it makes a class with a getter for each field and `copyWith()`.
 *
 * @throws TypeError for a field named `__proto__`.
 *
 * @example
 * ```ts
 * export const CreateOrder = objectOf({
 *   email: Email,
 *   quantity: PositiveInteger,
 *   note: schemaOf(AnyString).optional(),
 * });
 *
 * CreateOrder.parse(body); // { ok: true, value: { email: Email, quantity: PositiveInteger } }
 * ```
 */
export const objectOf = <const Fields extends ObjectFields>(
  fields: Fields,
  ...constraints: AnyConstraint[]
): ObjectSchema<ObjectInput<Fields>, ObjectValue<Fields>> =>
  new ObjectSchema(fieldsOf(fields), constraints, false);
