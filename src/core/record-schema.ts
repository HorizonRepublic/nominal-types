import { emitRecord } from './collection-emitters.ts';
import type { ConstraintField, ConstraintInput, ConstraintValue } from './constraint-types.ts';
import { planOf } from './fast-paths.ts';
import { describeField } from './field-json.ts';
import { describeValue } from './messages.ts';
import { isNominalType } from './nominal.ts';
import { fieldRunner } from './object-helpers.ts';
import { writerOf } from './plain-writers.ts';
import { addEmitter } from './plan-emitters.ts';
import { recordAcceptor, recordRun, recordWriter } from './record-shape.ts';
import type { RecordRules } from './record-shape.ts';
import { Rejection } from './rejection.ts';
import { fieldAcceptor } from './shape-acceptors.ts';
import type { StandardJSONSchemaV1 } from './standard-spec.ts';
import { checkerFor } from './type-functions.ts';
import { TypeSchema } from './type-schema.ts';

type KeyText<Key> = Key extends string
  ? Key
  : Key extends { readonly value: infer Text extends string }
    ? Text
    : string;

/**
 * The keys of a record whose keys are checked by `Key`: its string values, or `string` for a
 * nominal type whose values are any text.
 *
 * @typeParam Key - The type or schema of the keys.
 */
export type RecordKey<Key extends ConstraintField> = KeyText<ConstraintValue<Key>>;

/**
 * What `n.record()` gives: an object from each key to the value of `Value`. A value schema that
 * accepts `undefined` makes every key optional.
 *
 * @typeParam Key - The type or schema of the keys.
 * @typeParam Value - The type or schema of the values.
 */
export type RecordValue<Key extends ConstraintField, Value extends ConstraintField> =
  undefined extends ConstraintInput<Value>
    ? Readonly<Partial<Record<RecordKey<Key>, Exclude<ConstraintValue<Value>, undefined>>>>
    : Readonly<Record<RecordKey<Key>, ConstraintValue<Value>>>;

/**
 * What `n.record()` accepts: an object from each key to an input of `Value`.
 *
 * @typeParam Key - The type or schema of the keys.
 * @typeParam Value - The type or schema of the values.
 */
export type RecordInput<Key extends ConstraintField, Value extends ConstraintField> =
  undefined extends ConstraintInput<Value>
    ? Readonly<Partial<Record<KeyText<ConstraintInput<Key>>, ConstraintInput<Value>>>>
    : Readonly<Record<KeyText<ConstraintInput<Key>>, ConstraintInput<Value>>>;

interface RecordOptions {
  readonly partial: boolean;
  readonly min: number;
  readonly max: number;
}

const isString = (value: unknown): value is string => typeof value === 'string';

const isField = (value: unknown): value is ConstraintField =>
  isNominalType(value) ||
  (typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, '~standard') === 'object');

/**
 * The key or the value of a record, checked to be a nominal type or a schema.
 *
 * @throws {@link TypeError} when it is neither.
 *
 * @internal
 */
const checkedField = (role: 'key' | 'value', field: unknown): ConstraintField => {
  if (!isField(field)) {
    throw new TypeError(
      `n.record(): the ${role} must be a nominal type or a schema (was ${describeValue(field)})`,
    );
  }

  return field;
};

const draft = { target: 'draft-2020-12' } as const;

/**
 * The listed keys of a key schema that gives the listed strings themselves, such as `n.oneOf()`;
 * a nominal type gives instances, so its keys stay open, as TypeScript types them `string`.
 *
 * @throws {@link TypeError} when the key schema describes values other than strings, or lists
 * `__proto__`.
 *
 * @internal
 */
const closedKeys = (
  key: ConstraintField,
  runKey: (input: unknown) => unknown,
): readonly string[] | undefined => {
  let schema: Record<string, unknown>;

  try {
    schema = describeField(key, 'input', draft, 'record');
  } catch {
    return undefined;
  }

  const listed: unknown = Object.hasOwn(schema, 'const') ? [schema['const']] : schema['enum'];

  if (Array.isArray(listed)) {
    if (!listed.every((name) => isString(name))) {
      throw new TypeError('n.record(): the key must be a type or schema of strings');
    }

    if (isNominalType(key) || !isString(runKey(listed[0]))) {
      return undefined;
    }

    if (listed.includes('__proto__')) {
      throw new TypeError('n.record(): a key cannot be named __proto__');
    }

    return listed;
  }

  if (schema['type'] !== 'string') {
    throw new TypeError('n.record(): the key must be a type or schema of strings');
  }

  return undefined;
};

// A key is a string, so a nominal type of keys runs its rules without making an instance.
const keyRunner = (key: ConstraintField): ((input?: unknown) => unknown) =>
  isNominalType(key) ? checkerFor(key) : fieldRunner(key, 'n.record()');

/**
 * A limit on the key count, checked.
 *
 * @throws {@link TypeError} when it is not a whole number from 0 up.
 *
 * @internal
 */
const checkedCount = (method: string, count: unknown): number => {
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new TypeError(
      `${method}(): the count must be a whole number from 0 up (was ${String(count)})`,
    );
  }

  return count;
};

/**
 * An object whose keys are not known in advance, each key checked by one schema and each value by
 * another: what `n.record()` returns.
 *
 * @remarks
 * It is a `TypeSchema`, so `array()`, `optional()` and `nullable()` build on it, and a nominal type
 * takes it as its rule.
 *
 * @typeParam Input - What the schema accepts.
 * @typeParam Output - What the schema gives back.
 *
 * @example
 * ```ts
 * import { n, NonEmptyString, PositiveInteger } from '@horizon-republic/nominal-types';
 *
 * const Stock = n.record(NonEmptyString, PositiveInteger).max(1000);
 *
 * Stock.parse({ apples: 3, pears: 5 }).ok; // true
 * ```
 */
export class RecordSchema<Input, Output> extends TypeSchema<Input, Output> {
  /**
   * The keys the record requires, for a key schema of listed strings such as `n.oneOf()`;
   * `undefined` when any key its schema accepts may appear.
   */
  public readonly keys: readonly string[] | undefined;
  readonly #key: ConstraintField;
  readonly #value: ConstraintField;
  readonly #options: RecordOptions;

  /**
   * Built by `n.record()` and the methods below.
   *
   * @throws {@link TypeError} when the key or the value is not a nominal type or a schema, or the
   * key is not a type or schema of strings.
   *
   * @internal
   */
  public constructor(key: unknown, value: unknown, options: RecordOptions) {
    const keyField = checkedField('key', key);
    const valueField = checkedField('value', value);
    const runKey = keyRunner(keyField);
    const keys = closedKeys(keyField, runKey);
    const runValue = fieldRunner(valueField, 'n.record()');
    const rules: RecordRules = {
      key: runKey,
      value: runValue,
      optional: options.partial || !(runValue() instanceof Rejection),
      required: keys ?? [],
      min: options.min,
      max: options.max,
    };
    const run = recordRun(rules);
    const write = recordWriter(writerOf(valueField));

    addEmitter('record', emitRecord);

    super(
      {
        shape: {
          // The function returns a new object of the checked keys and values, or a Rejection.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          run: run as (input: unknown) => Output | Rejection,
          describe: (side, target) =>
            describeRecord(keyField, valueField, keys, rules, side, target),
        },
        paths: {
          write,
          accepts: recordAcceptor(rules, fieldAcceptor(valueField, 'n.record()'), run),
          plan: { kind: 'record', value: planOf(valueField), write },
          parts: {
            kind: 'record',
            key: keyField,
            value: valueField,
            keys,
            optional: rules.optional,
            min: rules.min,
            max: rules.max,
          },
        },
      },
      { name: 'n.record()' },
    );
    this.keys = keys === undefined ? undefined : Object.freeze([...keys]);
    this.#key = keyField;
    this.#value = valueField;
    this.#options = options;
  }

  /**
   * This schema, refusing an object with fewer keys than `count`.
   *
   * @param count - The fewest keys allowed.
   * @returns A new schema with that lower limit.
   * @throws {@link TypeError} when the count is not a whole number from 0 up, or is above the
   * upper limit.
   *
   * @example
   * ```ts
   * import { n, NonEmptyString, Url } from '@horizon-republic/nominal-types';
   *
   * const Links = n.record(NonEmptyString, Url).min(1);
   * ```
   */
  public min(count: number): RecordSchema<Input, Output> {
    return this.#limited('min', checkedCount('min', count), this.#options.max);
  }

  /**
   * This schema, refusing an object with more keys than `count`, so a large input is refused
   * before any key is checked.
   *
   * @param count - The most keys allowed.
   * @returns A new schema with that upper limit.
   * @throws {@link TypeError} when the count is not a whole number from 0 up, or is below the
   * lower limit.
   *
   * @example
   * ```ts
   * import { n, NonEmptyString, Url } from '@horizon-republic/nominal-types';
   *
   * const Links = n.record(NonEmptyString, Url).max(50);
   * ```
   */
  public max(count: number): RecordSchema<Input, Output> {
    return this.#limited('max', this.#options.min, checkedCount('max', count));
  }

  /**
   * This schema with every key allowed to be missing, for keys listed by `n.oneOf()`, which are
   * all required otherwise.
   *
   * @returns A new schema whose keys may be missing.
   *
   * @example
   * ```ts
   * import { n, PositiveInteger } from '@horizon-republic/nominal-types';
   *
   * const Sizes = n.record(n.oneOf('s', 'm', 'l'), PositiveInteger).partial();
   *
   * Sizes.parse({ m: 2 }).ok; // true
   * ```
   */
  public partial(): RecordSchema<Partial<Input>, Partial<Output>> {
    // @throws-ignore the key and the value are the ones this schema already checked
    return new RecordSchema(this.#key, this.#value, { ...this.#options, partial: true });
  }

  /**
   * A new schema with other limits on the key count.
   *
   * @throws {@link TypeError} when the lower limit is above the upper one.
   *
   * @internal
   */
  #limited(method: string, min: number, max: number): RecordSchema<Input, Output> {
    if (min > max) {
      throw new TypeError(
        `${method}(): the record would need at least ${min} and at most ${max} keys`,
      );
    }

    // @throws-ignore the key and the value are the ones this schema already checked
    return new RecordSchema(this.#key, this.#value, { ...this.#options, min, max });
  }
}

/**
 * The JSON Schema of a record: its listed keys as properties, or any key its schema accepts.
 *
 * @throws {@link TypeError} when the key or the value can't describe itself.
 *
 * @internal
 */
const describeRecord = (
  key: ConstraintField,
  value: ConstraintField,
  keys: readonly string[] | undefined,
  rules: RecordRules,
  side: 'input' | 'output',
  target: StandardJSONSchemaV1.Options,
): Record<string, unknown> => {
  const values = describeField(value, side, target, 'record');
  const counts = {
    ...(rules.min > 0 ? { minProperties: rules.min } : {}),
    ...(rules.max === Number.POSITIVE_INFINITY ? {} : { maxProperties: rules.max }),
  };

  if (keys !== undefined) {
    return {
      type: 'object',
      properties: Object.fromEntries(keys.map((name) => [name, values])),
      required: rules.optional ? [] : [...keys],
      additionalProperties: false,
      ...counts,
    };
  }

  return {
    type: 'object',
    ...(target.target === 'openapi-3.0'
      ? {}
      : { propertyNames: describeField(key, side, target, 'record') }),
    additionalProperties: values,
    ...counts,
  };
};

/**
 * Builds a schema for an object whose keys are not known in advance, such as prices by currency or
 * labels by language: every key is checked by one schema, every value by another.
 *
 * @remarks
 * Every key and every value is checked, and every issue collected with the key in its path; a bad
 * key is reported as `key must be …`. Keys listed by `n.oneOf()` are all required, as in a
 * TypeScript `Record`, and no other key is allowed; `partial()` lets them be missing. A key named
 * `__proto__` is refused. A value given as `undefined` counts as a missing key. The result is a
 * new object, read-only by type; given to `Nominal()`, it is frozen.
 *
 * @typeParam Key - The type or schema of the keys.
 * @typeParam Value - The type or schema of the values.
 * @param key - A nominal type of strings, `n.oneOf()` of strings, or another schema of strings.
 * @param value - A nominal type, a `n.of()`, `n.object()`, `n.union()`, `n.record()` or `n.tuple()`
 * schema, or a synchronous Standard Schema.
 * @returns The schema of the record.
 * @throws {@link TypeError} when the key or the value is not a nominal type or a schema, or the key
 * is not a type or schema of strings.
 *
 * @example
 * ```ts
 * import { CurrencyCode, DecimalString, n } from '@horizon-republic/nominal-types';
 *
 * const Prices = n.record(CurrencyCode, DecimalString);
 *
 * Prices.parse({ EUR: '12.50', USD: '13.10' }).ok; // true
 * Prices.parse({ euro: '12.50' }).ok; // false: key must be an ISO 4217 currency code
 * ```
 */
export const record = <const Key extends ConstraintField, const Value extends ConstraintField>(
  key: Key,
  value: Value,
): RecordSchema<RecordInput<Key, Value>, RecordValue<Key, Value>> =>
  new RecordSchema(key, value, { partial: false, min: 0, max: Number.POSITIVE_INFINITY });
