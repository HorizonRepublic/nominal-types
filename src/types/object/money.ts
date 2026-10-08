import { constraint } from '../../core/constraint.ts';
import type { NominalSchema, NominalType, ObjectInstance } from '../../core/contracts.ts';
import { Nominal } from '../../core/nominal.ts';
import { objectOf } from '../../core/object-of.ts';
import type { ObjectInput, ObjectValue } from '../../core/object-types.ts';
import { equalityKeySlot, inOneLine, noKey } from '../../core/same-value.ts';
import type { EqualityKey } from '../../core/same-value.ts';
import { CurrencyCode } from '../string/currency-code.ts';
import { DecimalString, decimalText } from '../string/decimal-string.ts';

// oxlint-disable-next-line typescript/consistent-type-definitions -- an interface has no index signature, which ObjectFields needs
type MoneyFields = {
  readonly amount: typeof DecimalString;
  readonly currency: typeof CurrencyCode;
};
type MoneyInput = ObjectInput<MoneyFields>;
type MoneyValue = ObjectValue<MoneyFields>;

const fields: MoneyFields = { amount: DecimalString, currency: CurrencyCode };

const fitsCurrency = constraint(
  fields,
  ({ amount, currency }) => {
    const { minorUnits } = currency;

    if (minorUnits === undefined || amount.fractionDigits <= minorUnits) {
      return true;
    }

    return minorUnits === 0
      ? `must have no digits after the point in ${currency.value}`
      : `must have at most ${minorUnits} digits after the point in ${currency.value}`;
  },
  { path: 'amount' },
);

const MoneyBase: NominalType<
  'nominal.Money',
  NominalSchema<MoneyInput, MoneyValue>,
  ObjectInstance<'nominal.Money', MoneyInput, MoneyValue>
> = Nominal('nominal.Money', objectOf(fields, fitsCurrency));

// The digits after the point of a result: the currency's own, or for a currency without minor
// units, as many as the more precise of the amounts.
const scaleOf = (currency: CurrencyCode, ...amounts: readonly DecimalString[]): number =>
  currency.minorUnits ?? Math.max(...amounts.map((amount) => amount.fractionDigits));

/**
 * An amount of money in one currency, such as 12.34 EUR, held as exact decimal text and an
 * ISO 4217 code, so no amount ever passes through a binary float.
 *
 * @remarks
 * JSON carries it as `{ "amount": "12.34", "currency": "EUR" }`. The amount has at most as many
 * digits after the point as the currency's minor units: two for `EUR`, none for `JPY`; a currency
 * without minor units, such as `XAU`, takes any number. Arithmetic is exact and refuses to mix
 * currencies. `equals()` ignores trailing zeros: `12.5 EUR` equals `12.50 EUR`.
 *
 * @example
 * ```ts
 * const price = new Money({ amount: '12.34', currency: 'EUR' });
 *
 * price.add(new Money({ amount: '0.66', currency: 'EUR' })).amount.value; // '13.00'
 * price.minor; // 1234n
 * ```
 */
export class Money extends MoneyBase {
  /**
   * The money for a count of minor units, such as `1234n` cents for 12.34 EUR, the form payment
   * providers often send.
   *
   * @throws TypeError when the currency has no minor units, such as `XAU`.
   * @throws NominalError when the currency code is not an ISO 4217 code.
   */
  public static fromMinor<Type extends new (input: { amount: string; currency: string }) => Money>(
    this: Type,
    minor: bigint,
    currency: CurrencyCode | string,
  ): InstanceType<Type> {
    const code = typeof currency === 'string' ? new CurrencyCode(currency) : currency;

    if (code.minorUnits === undefined) {
      throw new TypeError(`fromMinor(): ${code.value} has no minor units`);
    }

    const money = new this({ amount: decimalText(minor, code.minorUnits), currency: code.value });

    // A class built from a nominal type makes instances of itself.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return money as InstanceType<Type>;
  }

  /**
   * The amount as a count of minor units, such as `1234n` cents for 12.34 EUR.
   *
   * @throws TypeError when the currency has no minor units, such as `XAU`.
   */
  public get minor(): bigint {
    const { minorUnits } = this.currency;

    if (minorUnits === undefined) {
      throw new TypeError(`minor: ${this.currency.value} has no minor units`);
    }

    return this.amount.toMinorUnits(minorUnits);
  }

  /**
   * Whether the amount is zero.
   */
  public get isZero(): boolean {
    return this.amount.sign === 0;
  }

  /**
   * Whether the amount is below zero.
   */
  public get isNegative(): boolean {
    return this.amount.sign === -1;
  }

  /**
   * The sum, written with the currency's minor units: `12.5 EUR` plus `1 EUR` is `13.50 EUR`.
   *
   * @throws TypeError when the currencies differ.
   */
  public add(other: Money): this {
    return this.#combine('add', other, 1n);
  }

  /**
   * The difference, written with the currency's minor units.
   *
   * @throws TypeError when the currencies differ.
   */
  public subtract(other: Money): this {
    return this.#combine('subtract', other, -1n);
  }

  /**
   * The amount times a whole number, such as a price times a quantity.
   *
   * @throws RangeError when the factor is not a whole number.
   */
  public multiply(factor: bigint | number): this {
    if (typeof factor === 'number' && !Number.isSafeInteger(factor)) {
      throw new RangeError(`multiply(): the factor must be a safe integer (was ${factor})`);
    }

    const scale = scaleOf(this.currency, this.amount);

    return this.copyWith({
      amount: decimalText(this.amount.toMinorUnits(scale) * BigInt(factor), scale),
    });
  }

  /**
   * `-1` if this amount is smaller than the other, `1` if larger, `0` if they are equal.
   *
   * @throws TypeError when the currencies differ.
   */
  public compare(other: Money): -1 | 0 | 1 {
    this.#checkCurrency('compare', other);

    return this.amount.compare(other.amount);
  }

  /**
   * The same money with exactly the currency's minor units after the point: `12.5 EUR` becomes
   * `12.50 EUR`, and `-0 EUR` becomes `0.00 EUR`; for a currency without minor units, the
   * shortest text of the amount.
   */
  public canonical(): this {
    const { minorUnits } = this.currency;
    const amount =
      minorUnits === undefined
        ? this.amount.canonical().value
        : decimalText(this.amount.toMinorUnits(minorUnits), minorUnits);

    return this.copyWith({ amount });
  }

  /**
   * The amount as people read it, such as `€12.34` in `en-US`, through `Intl.NumberFormat` with
   * the digits of the currency's minor units. For display only: the text depends on the locale
   * and on the runtime's locale data, so never parse it back.
   */
  public format(locales?: string | readonly string[]): string {
    const digits = scaleOf(this.currency, this.amount);
    const formatter = new Intl.NumberFormat(locales, {
      style: 'currency',
      currency: this.currency.value,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

    // `format()` reads a string as an exact decimal, so the amount loses no digits.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return formatter.format(this.amount.value as `${number}`);
  }

  /**
   * Whether the other value is the same amount in the same currency, ignoring trailing zeros, and
   * belongs to this type, a type under it or the type it is under, like `equals()` on every type.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) &&
      other instanceof Money &&
      other.currency.value === this.currency.value &&
      other.amount.equals(this.amount)
    );
  }

  #checkCurrency(method: string, other: Money): void {
    if (other.currency.value !== this.currency.value) {
      throw new TypeError(
        `${method}(): ${other.currency.value} cannot be mixed with ${this.currency.value}`,
      );
    }
  }

  #combine(method: string, other: Money, direction: bigint): this {
    this.#checkCurrency(method, other);

    const scale = scaleOf(this.currency, this.amount, other.amount);
    const sum = this.amount.toMinorUnits(scale) + direction * other.amount.toMinorUnits(scale);

    return this.copyWith({ amount: decimalText(sum, scale) });
  }
}

const moneyEqualityKey: EqualityKey = {
  equals: Reflect.get(Money.prototype, 'equals'),
  key: (item) =>
    item instanceof Money ? `${item.amount.canonical().value} ${item.currency.value}` : noKey,
};

Object.defineProperty(Money.prototype, equalityKeySlot, { value: moneyEqualityKey });
