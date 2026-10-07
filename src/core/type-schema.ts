import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import type { AnyNominalType, InputOf, Parsed } from './contracts.ts';
import { construct, isNominalType } from './nominal.ts';
import { Rejection } from './rejection.ts';
import { runners } from './runner.ts';
import { describeValue, forTarget, withoutUri } from './schema-text.ts';
import type { StandardProps } from './standard-schema.ts';

type Run<Output> = (input: unknown) => Output | Rejection;

type Describe = (
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
) => Record<string, unknown>;

/**
 * How many items `array()` accepts: an exact `length`, or a `min`, a `max` or both.
 */
export interface ArrayOptions {
  readonly length?: number;
  readonly min?: number;
  readonly max?: number;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const items = (count: number): string => (count === 1 ? '1 item' : `${count} items`);

const boundsOf = (options: ArrayOptions): { readonly min: number; readonly max: number } => {
  const { length, min, max } = options;
  for (const [name, value] of Object.entries({ length, min, max })) {
    if (value !== undefined && !isCount(value)) {
      throw new TypeError(
        `array(): ${name} must be a whole number from 0 up (was ${String(value)})`,
      );
    }
  }
  if (length !== undefined && (min !== undefined || max !== undefined)) {
    throw new TypeError('array(): pass either length or min and max, not both');
  }
  if (min !== undefined && max !== undefined && min > max) {
    throw new TypeError(`array(): min (${min}) is greater than max (${max})`);
  }
  return {
    min: length ?? min ?? 0,
    max: length ?? max ?? Number.POSITIVE_INFINITY,
  };
};

const countMessage = (options: ArrayOptions, count: number): string => {
  if (options.length !== undefined) {
    return `must have ${items(options.length)} (was ${count})`;
  }
  return options.min !== undefined && count < options.min
    ? `must have at least ${items(options.min)} (was ${count})`
    : `must have at most ${items(options.max ?? 0)} (was ${count})`;
};

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

  /**
   * Internal: built by `schemaOf()` and the methods below.
   */
  public constructor(run: Run<Output>, describe: Describe) {
    this.#run = run;
    this.#describe = describe;
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
    return new TypeSchema<readonly Input[], readonly Output[]>(
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
   * This schema, or `undefined`, for a value that may be missing.
   *
   * @remarks
   * JSON has no `undefined`, so the JSON Schema is that of the value; a missing property is
   * expressed by leaving it out of `required` in the object around it.
   */
  public optional(): TypeSchema<Input | undefined, Output | undefined> {
    const item = this.#run;
    return new TypeSchema<Input | undefined, Output | undefined>(
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
    return new TypeSchema<Input | null, Output | null>(
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
  );
};
