import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import { boundsOf, countMessage } from './array-bounds.ts';
import type { ArrayOptions } from './array-bounds.ts';
import type { AnyNominalType, InputOf, Parsed } from './contracts.ts';
import { construct, isNominalType } from './nominal.ts';
import { Rejection } from './rejection.ts';
import { runners } from './runner.ts';
import { describeValue, forTarget, withoutUri } from './schema-text.ts';
import type { StandardProps } from './standard-schema.ts';
import { textFormOf } from './text-form.ts';
import type { TextForm } from './text-form.ts';

type Run<Output> = (input: unknown) => Output | Rejection;

type Describe = (
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
) => Record<string, unknown>;

const arraySchemas = new WeakSet<object>();

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
  Reflect.get(Reflect.get(value, '~standard') ?? {}, 'vendor') ===
    '@horizon-republic/nominal-types';

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
  readonly #run: Run<Output>;
  readonly #describe: Describe;
  readonly #textForm: TextForm | undefined;

  /**
   * Internal: built by `schemaOf()` and the methods below.
   */
  public constructor(run: Run<Output>, describe: Describe, textForm?: TextForm) {
    this.#run = run;
    this.#describe = describe;
    this.#textForm = textForm;
    runners.set(this, run);
    this['~standard'] = {
      version: 1,
      vendor: '@horizon-republic/nominal-types',
      validate: (value) => {
        const result = run(value);
        return result instanceof Rejection ? { issues: result.issues } : { value: result };
      },
      jsonSchema: {
        input: (options) => forTarget(options, describe('input', options)),
        output: (options) => forTarget(options, describe('output', options)),
      },
    };
  }

  #wrap<WrappedInput, WrappedOutput>(
    array: boolean,
    run: Run<WrappedOutput>,
    describe: Describe,
  ): TypeSchema<WrappedInput, WrappedOutput> {
    const wrapped = new TypeSchema<WrappedInput, WrappedOutput>(run, describe);
    if (array) {
      arraySchemas.add(wrapped);
    }
    return wrapped;
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
    const result = this.#run(input);
    return result instanceof Rejection
      ? { ok: false, issues: result.issues }
      : { ok: true, value: result };
  }

  /**
   * An array of values this schema accepts, frozen so it stays valid.
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
    const { min, max } = boundsOf(options);
    const item = this.#run;
    const describe = this.#describe;
    return this.#wrap<readonly Input[], readonly Output[]>(
      true,
      (input) => {
        if (!Array.isArray(input)) {
          return new Rejection([{ message: `must be an array (was ${describeValue(input)})` }]);
        }
        const list: readonly unknown[] = input;
        const count = list.length;
        if (count < min || count > max) {
          return new Rejection([{ message: countMessage(options, count) }]);
        }
        const values: Output[] = [];
        let issues: StandardSchemaV1.Issue[] | undefined;
        for (let index = 0; index < count; index += 1) {
          const result = item(list[index]);
          if (result instanceof Rejection) {
            issues ??= [];
            for (const issue of result.issues) {
              issues.push({ message: issue.message, path: [index, ...(issue.path ?? [])] });
            }
          } else if (issues === undefined) {
            values.push(result);
          }
        }
        return issues === undefined ? Object.freeze(values) : new Rejection(issues);
      },
      (side, target) => ({
        type: 'array',
        items: describe(side, target),
        ...(min > 0 ? { minItems: min } : {}),
        ...(max === Number.POSITIVE_INFINITY ? {} : { maxItems: max }),
      }),
    );
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
        'fromString(): call it on schemaOf(Type) of a string, number, bigint or boolean type, before array(), optional() or nullable()',
      );
    }
    const item = this.#run;
    return new TypeSchema<Input | string, Output>(
      (input) => item(typeof input === 'string' ? (form(input) ?? input) : input),
      this.#describe,
    );
  }

  /**
   * This schema, or `undefined`, for a value that may be missing.
   *
   * @remarks
   * JSON has no `undefined`, so the JSON Schema is that of the value; a missing property is
   * expressed by leaving it out of `required` in the object around it.
   */
  public optional(): TypeSchema<Input | undefined, Output | undefined> {
    const item = this.#run;
    return this.#wrap<Input | undefined, Output | undefined>(
      isArraySchema(this),
      (input) => (input === undefined ? undefined : item(input)),
      this.#describe,
    );
  }

  /**
   * This schema, or `null`, for a value that may be explicitly empty.
   *
   * @remarks
   * In JSON Schema it becomes an `anyOf` with `{ type: 'null' }`; for OpenAPI 3.0, which has no
   * `null` type, the value's schema with `nullable: true`.
   */
  public nullable(): TypeSchema<Input | null, Output | null> {
    const item = this.#run;
    const describe = this.#describe;
    return this.#wrap<Input | null, Output | null>(
      isArraySchema(this),
      (input) => (input === null ? null : item(input)),
      (side, options) =>
        options.target === 'openapi-3.0'
          ? { ...describe(side, options), nullable: true }
          : { anyOf: [describe(side, options), { type: 'null' }] },
    );
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
  return new TypeSchema<InputOf<Type['rule']>, Type['prototype']>(
    // construct() returns an instance of `type` or a Rejection; the compiler can't follow the
    // class hierarchy that far, and parse() would allocate a result object per value.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    (input) => construct(type, input) as Type['prototype'] | Rejection,
    (side, options) => withoutUri(type['~standard'].jsonSchema[side](options)),
    textFormOf(type),
  );
};
