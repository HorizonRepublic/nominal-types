import type { IssueCode } from './issue-codes.ts';
import { describeValue, mustBe } from './messages.ts';
import { NativeSchema } from './native-schema.ts';
import { stringOnly } from './string-rule.ts';

/**
 * A value `n.oneOf()` can list: one JSON can carry as it is.
 */
export type OneOfValue = string | number | boolean | null;

const isListable = (value: unknown): value is OneOfValue =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  value === null ||
  (typeof value === 'number' && Number.isFinite(value));

const jsonTypeOf = (value: OneOfValue): string => {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }

  return typeof value;
};

// One `type` beside `enum` helps code generators; values of several kinds are described by `enum`
// alone, which every target reads the same way.
const sharedType = (values: readonly OneOfValue[]): string | undefined => {
  const types = new Set(values.map((value) => jsonTypeOf(value)));

  if (types.size === 2 && types.has('integer') && types.has('number')) {
    return 'number';
  }

  const [only] = types;

  return types.size === 1 && only !== 'null' ? only : undefined;
};

/**
 * The values of `n.oneOf()`, once they are known to be listable and distinct.
 *
 * @throws {@link TypeError} when there are no values, a value is not a string, a finite number, a
 * boolean or `null`, or a value is listed twice.
 *
 * @internal
 */
const checkedValues = <Value extends OneOfValue>(values: readonly Value[]): Set<Value> => {
  if (values.length === 0) {
    throw new TypeError('n.oneOf(): list at least one value');
  }

  const set = new Set<Value>();

  for (const value of values) {
    if (!isListable(value)) {
      throw new TypeError(
        `n.oneOf(): values must be strings, finite numbers, booleans or null (was ${describeValue(value)})`,
      );
    }

    if (set.has(value)) {
      throw new TypeError(`n.oneOf(): ${describeValue(value)} is listed twice`);
    }

    set.add(value);
  }

  return set;
};

/**
 * A Standard Schema that accepts only the values it lists: what `n.oneOf()` returns.
 *
 * @remarks
 * Nominal types recognise it and test the value directly, without going through `validate`. A
 * value is the same as a listed one when `===` says so, so `'Draft'` is not `'draft'` and `'1'` is
 * not `1`.
 *
 * @typeParam Value - The listed values.
 *
 * @example
 * ```ts
 * import { n } from '@horizon-republic/nominal-types';
 *
 * const status = n.oneOf('draft', 'paid', 'shipped');
 *
 * status.values; // ['draft', 'paid', 'shipped']
 * status.accepts('paid'); // true
 * ```
 */
export class OneOfSchema<Value extends OneOfValue> extends NativeSchema<Value> {
  /**
   * The listed values, in the order they were given.
   */
  public readonly values: readonly Value[];
  /**
   * What a listed value is, completing "must be …" in messages, such as
   * `one of "draft", "paid"`.
   */
  public readonly description: string;
  /**
   * Whether the value is one of the listed values; a plain function, so it can be called on its
   * own.
   */
  public readonly accepts: (value: unknown) => value is Value;

  /**
   * Builds the schema; `n.oneOf()` does the same and takes the values one by one.
   *
   * @param values - The values to accept, each listed once.
   * @throws {@link TypeError} when the list is empty, a value is listed twice, or a value is not a
   * string, a finite number, a boolean or `null`.
   */
  public constructor(values: readonly Value[]) {
    super();

    const set = checkedValues(values);
    const listed = values.map((value) => describeValue(value)).join(', ');

    this.values = Object.freeze([...values]);
    this.description = values.length === 1 ? listed : `one of ${listed}`;
    // The set holds only values of `Value`, so a value it has is one of them.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    this.accepts = (value): value is Value => set.has(value as Value);

    if (values.every((value) => typeof value === 'string')) {
      stringOnly(this);
    }
  }

  public messageFor(value: unknown, describe?: (value: unknown) => string): string {
    return mustBe(this.description, value, describe);
  }

  public override codeFor(_value: unknown): IssueCode {
    return 'not_one_of';
  }

  public descriptionFor(_value: unknown): string {
    return this.description;
  }

  protected jsonBody(): Record<string, unknown> {
    const type = sharedType(this.values);

    return {
      ...(type === undefined ? {} : { type }),
      enum: [...this.values],
      description: this.description,
    };
  }
}

/**
 * Builds a schema for a fixed set of values, such as the states of an order or the sizes of a
 * shirt.
 *
 * @remarks
 * Each value is a string, a finite number, a boolean or `null`, listed once. The type's value is
 * the union of the listed literals. A TypeScript `enum` is not taken as an object, since a
 * numeric enum also holds its member names; list its members instead, or spread
 * `Object.values()` of a string enum.
 *
 * @typeParam Values - The listed values.
 * @param values - The values to accept, each listed once.
 * @returns The schema of the listed values.
 * @throws {@link TypeError} when the list is empty, a value is listed twice, or a value is of
 * another kind, such as a bigint, `NaN` or an object.
 *
 * @example
 * ```ts
 * import { AnyString, n } from '@horizon-republic/nominal-types';
 *
 * export class OrderStatus extends AnyString.subtype(
 *   'shop.OrderStatus',
 *   n.oneOf('draft', 'paid', 'shipped'),
 * ) {}
 *
 * OrderStatus.parse('lost');
 * // { ok: false, issues: [{ message: 'must be one of "draft", "paid", "shipped" (was "lost")' }] }
 * ```
 */
export const oneOf = <const Values extends readonly OneOfValue[]>(
  ...values: Values
): OneOfSchema<Values[number]> => new OneOfSchema<Values[number]>(values);
