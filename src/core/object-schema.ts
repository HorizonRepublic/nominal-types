import { checkConstraintFields } from './constraint-fields.ts';
import type {
  AnyConstraint,
  ConstraintField,
  ConstraintInput,
  ConstraintValue,
} from './constraint-types.ts';
import { describeField } from './field-json.ts';
import { foreignRunner } from './foreign-runner.ts';
import { hideValues } from './hidden-values.ts';
import { isNominalType } from './nominal.ts';
import { objectMark } from './object-members.ts';
import { objectShape } from './object-shape.ts';
import type { ObjectField } from './object-shape.ts';
import { Rejection } from './rejection.ts';
import { textFormOf } from './text-form.ts';
import { instanceParserFor } from './type-functions.ts';
import { schemaOf, TypeSchema } from './type-schema.ts';

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

const runnerOf = (field: ConstraintField): ((value?: unknown) => unknown) =>
  isNominalType(field) ? instanceParserFor(field) : foreignRunner(field, 'n.object()');

const fieldsOf = (fields: ObjectFields): ObjectField[] =>
  Object.entries(fields).map(([key, field]) => {
    if (key === '__proto__') {
      throw new TypeError('n.object(): a field cannot be named __proto__');
    }

    const run = runnerOf(field);

    return {
      key,
      run,
      optional: !(run() instanceof Rejection),
      describe: (side, options) => describeField(field, side, options, 'object'),
    };
  });

type ObjectShape = ReturnType<typeof objectShape>;

const hidingValues = (shape: ObjectShape): ObjectShape => ({
  run: (input) => {
    const result = shape.run(input);

    return result instanceof Rejection ? new Rejection(hideValues(result.issues)) : result;
  },
  describe: shape.describe,
  sensitive: true,
});

/**
 * An object made of fields, each checked by its own schema: what `n.object()` returns.
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
  readonly #source: ObjectFields;
  readonly #constraints: readonly AnyConstraint[];
  readonly #strict: boolean;
  readonly #hidden: boolean;

  /**
   * Internal: built by `n.object()`, `strict()` and `fromEnv()`; `hidden` leaves the values out of
   * the messages.
   */
  public constructor(
    source: ObjectFields,
    constraints: readonly AnyConstraint[],
    strict: boolean,
    hidden: boolean = false,
  ) {
    const fields = fieldsOf(source);

    checkConstraintFields(
      'n.object',
      fields.map(({ key }) => key),
      constraints,
    );

    const shape = objectShape(fields, constraints, strict);

    // The shape returns a new object of the fields, which is what Output describes.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    super((hidden ? hidingValues(shape) : shape) as never);
    this.keys = fields.map(({ key }) => key);
    this.#source = source;
    this.#constraints = constraints;
    this.#strict = strict;
    this.#hidden = hidden;
    Object.defineProperty(this, objectMark, { value: true });
  }

  /**
   * This schema, refusing keys it doesn't declare instead of dropping them.
   */
  public strict(): ObjectSchema<Input, Output> {
    return new ObjectSchema(this.#source, this.#constraints, true, this.#hidden);
  }

  /**
   * This schema, reading each field of a nominal type with a text form from a string: numbers,
   * booleans, big integers and strings. For configuration read from environment variables, and
   * any other record of strings, such as query parameters.
   *
   * @remarks
   * Fields of other kinds, such as `n.of()` and `n.object()` schemas, are kept as they are;
   * give them `fromString()` yourself where they read text. Undeclared keys are dropped, so the
   * whole `process.env` can be passed. Messages leave the values out, as those of a sensitive type
   * do, since configuration holds secrets: `must be a URL (was a string of 31 characters)`.
   *
   * @example
   * ```ts
   * export class Config extends Nominal(
   *   'app.Config',
   *   n.object({ PORT: Port, DEBUG: AnyBoolean, DATABASE_URL: Url }).fromEnv(),
   * ) {}
   *
   * export const config = new Config(process.env);
   * config.PORT; // Port, from the text '3000'
   * ```
   */
  public fromEnv(): ObjectSchema<TextInput<Input>, Output> {
    const fields = Object.fromEntries(
      Object.entries(this.#source).map(([key, field]) => [
        key,
        isNominalType(field) && textFormOf(field) !== undefined
          ? schemaOf(field).fromString()
          : field,
      ]),
    );

    return new ObjectSchema(fields, this.#constraints, this.#strict, true);
  }
}

/**
 * Whether a value is a schema built by `n.object()`, also by another copy of this package.
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
 * `undefined`, such as `n.of(Type).optional()`, may be missing; any other missing field is
 * reported as `is required`. Only the input's own keys are read. The constraints run once every
 * field is valid. The result is a new object, read-only by type; given to `Nominal()`, it is
 * frozen.
 *
 * Given to `Nominal()`, it makes a class with a getter for each field and `copyWith()`.
 *
 * @throws TypeError for a field named `__proto__`.
 *
 * @example
 * ```ts
 * export const CreateOrder = n.object({
 *   email: Email,
 *   quantity: PositiveInteger,
 *   note: n.of(AnyString).optional(),
 * });
 *
 * CreateOrder.parse(body); // { ok: true, value: { email: Email, quantity: PositiveInteger } }
 * ```
 */
export const objectOf = <const Fields extends ObjectFields>(
  fields: Fields,
  ...constraints: AnyConstraint[]
): ObjectSchema<ObjectInput<Fields>, ObjectValue<Fields>> =>
  new ObjectSchema(fields, constraints, false);
