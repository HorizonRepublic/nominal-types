import type { ArrayOptions } from './array-bounds.ts';
import type { AnyNominalType, InputOf, Parsed } from './contracts.ts';
import { forTarget, withoutUri } from './json-target.ts';
import { describeValue } from './messages.ts';
import { isNominalType } from './nominal.ts';
import { Rejection } from './rejection.ts';
import { runners } from './runner.ts';
import { arrayShape, nullableShape, optionalShape, textShape } from './shapes.ts';
import type { Shape } from './shapes.ts';
import { shared } from './shared.ts';
import { standardProps, vendor } from './standard-props.ts';
import type { StandardProps } from './standard-schema.ts';
import { textFormOf } from './text-form.ts';
import type { TextForm } from './text-form.ts';
import { constructorFor } from './type-functions.ts';

const { arraySchemas } = shared;

/**
 * Internal: whether a schema accepts an array at its top, also behind `optional()` and
 * `nullable()`, so an adapter can wrap a lone value from a query string.
 */
export const isArraySchema = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && arraySchemas.has(value);

/**
 * Internal: whether a value is a schema built by `schemaOf()`, including one from another copy of
 * this package.
 */
export const isTypeSchema = (value: unknown): value is TypeSchema<unknown, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'parse') === 'function' &&
  typeof Reflect.get(value, 'array') === 'function' &&
  Reflect.get(Reflect.get(value, '~standard') ?? {}, 'vendor') === vendor;

/**
 * A nominal type, or a shape around one, as a plain Standard Schema object: what `schemaOf()`
 * returns.
 *
 * @remarks
 * Each method returns a new schema and leaves this one as it is, so a schema can be shared and
 * extended freely. The methods read left to right: `schemaOf(Uuid).array().optional()` is an
 * optional array, `schemaOf(Uuid).optional().array()` an array of optional items.
 */
export class TypeSchema<Input, Output> {
  public readonly '~standard': StandardProps<Input, Output>;
  readonly #shape: Shape<Output>;
  readonly #textForm: TextForm | undefined;

  /**
   * Internal: built by `schemaOf()` and the methods below.
   */
  public constructor(
    shape: Shape<Output>,
    options: { readonly textForm?: TextForm | undefined; readonly array?: boolean } = {},
  ) {
    this.#shape = shape;
    this.#textForm = options.textForm;
    this['~standard'] = standardProps(shape.run, (side, target) =>
      forTarget(target, shape.describe(side, target)),
    );
    runners.set(this, shape.run);

    if (options.array === true) {
      arraySchemas.add(this);
    }
  }

  /**
   * Checks a value without throwing: the result, or the issues that prevented it.
   *
   * @example
   * ```ts
   * schemaOf(Uuid).array().parse(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', 'nope']);
   * // { ok: false, issues: [{ message: 'must be a UUID (was "nope")', path: [1] }] }
   * ```
   */
  public parse(input: unknown): Parsed<Output> {
    const result = this.#shape.run(input);

    return result instanceof Rejection
      ? { ok: false, issues: result.issues }
      : { ok: true, value: result };
  }

  /**
   * A new array of values this schema accepts, read-only by type.
   *
   * @remarks
   * The number of items is checked before any item, so an array that is too long costs nothing
   * more. Every item is checked, and each issue carries the item's index in its path.
   *
   * @throws TypeError when the options are not whole numbers from 0 up, mix `length` with `min`
   * or `max`, or put `min` above `max`.
   *
   * @example
   * ```ts
   * schemaOf(Url).array({ max: 10 });
   * schemaOf(UserId).array({ length: 3 });
   * ```
   */
  public array(options: ArrayOptions = {}): TypeSchema<readonly Input[], readonly Output[]> {
    return new TypeSchema(arrayShape(this.#shape, options), { array: true });
  }

  /**
   * This schema, reading its value from text first, for values that arrive as strings: environment
   * variables, query strings, form fields, CSV.
   *
   * @remarks
   * Only a string is read; any other value goes to the rule as it is. Numbers are read the way
   * JSON writes them (`'2'`, `'-1.5'`, `'1e3'`), booleans from `'true'` and `'false'`; other text
   * reaches the rule unchanged and is rejected with the usual message. String and bigint types
   * take text already. Call it on `schemaOf(Type)` itself, before `array()`, `optional()` or
   * `nullable()`.
   *
   * @throws TypeError when called after another method, or for a type with no text form, such as
   * one declared from scratch with `Nominal()`.
   *
   * @example
   * ```ts
   * schemaOf(Port).fromString().parse(process.env.PORT);
   * schemaOf(PositiveInteger).fromString().array();
   * ```
   */
  public fromString(): TypeSchema<Input | string, Output> {
    const form = this.#textForm;

    if (form === undefined) {
      throw new TypeError(
        'fromString(): call it on schemaOf(Type) of a string, number, bigint or boolean type, before array(), optional() or nullable(); for an objectOf() schema, call fromEnv()',
      );
    }

    return new TypeSchema<Input | string, Output>(textShape(this.#shape, form));
  }

  /**
   * This schema, or `undefined`, for a value that may be missing.
   *
   * @remarks
   * JSON has no `undefined`, so the JSON Schema is that of the value; a missing property is
   * expressed by leaving it out of `required` in the object around it.
   */
  public optional(): TypeSchema<Input | undefined, Output | undefined> {
    return new TypeSchema(optionalShape(this.#shape), { array: isArraySchema(this) });
  }

  /**
   * This schema, or `null`, for a value that may be explicitly empty.
   *
   * @remarks
   * In JSON Schema it becomes an `anyOf` with `{ type: 'null' }`; for OpenAPI 3.0, which has no
   * `null` type, the value's schema with `nullable: true`.
   */
  public nullable(): TypeSchema<Input | null, Output | null> {
    return new TypeSchema(nullableShape(this.#shape), { array: isArraySchema(this) });
  }
}

/**
 * A nominal type as a plain Standard Schema object, to pass where a class doesn't fit and to
 * build arrays and optional values from.
 *
 * @remarks
 * Libraries that parse their own definitions, such as ArkType, treat a class as one of their own
 * constructs, so they take this object instead. The same object goes to `NominalPipe` and to
 * NestJS's `{ schema }`.
 *
 * @throws TypeError when `type` is not a nominal type.
 *
 * @example
 * ```ts
 * type({ email: schemaOf(Email), team: schemaOf(Uuid) });
 * schemaOf(Uuid).array({ min: 1, max: 100 });
 * schemaOf(Email).optional();
 * ```
 */
export const schemaOf = <Type extends AnyNominalType>(
  type: Type,
): TypeSchema<InputOf<Type['rule']>, Type['prototype']> => {
  if (!isNominalType(type)) {
    throw new TypeError(`schemaOf() takes a nominal type (was ${describeValue(type)})`);
  }

  const construct = constructorFor(type);

  return new TypeSchema<InputOf<Type['rule']>, Type['prototype']>(
    {
      // The function makes an instance of `type` or a Rejection; the compiler can't follow the
      // class hierarchy that far, and parse() would allocate a result object per value.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      run: construct as (input: unknown) => Type['prototype'] | Rejection,
      describe: (side, options) => withoutUri(type['~standard'].jsonSchema[side](options)),
    },
    { textForm: textFormOf(type) },
  );
};
