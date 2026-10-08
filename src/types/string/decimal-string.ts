import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { equalityKeySlot, inOneLine } from '../../core/same-value.ts';
import type { EqualityKey } from '../../core/same-value.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyString } from './any-string.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';

const longest = 100;
const grammar = '-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?';
const pattern = new RegExp(`^(?=.{1,${longest}}$)${grammar}$`, 'u');
const trailingZeros = /\.?0+$/u;

const DecimalStringBase: SubtypeOf<
  typeof AnyString,
  'nominal.DecimalString',
  string,
  typeof NonBlankString
> = AnyString.subtype(
  'nominal.DecimalString',
  // The length lookahead stays out of the JSON Schema, which RE2-based tools couldn't compile.
  matching(pattern, 'a decimal number as text', {
    pattern: `^${grammar}$`,
    minLength: 1,
    maxLength: longest,
    examples: ['12.34', '-0.5'],
  }),
  { implies: [nonBlankString] },
);

interface Parts {
  readonly negative: boolean;
  readonly integer: string;
  readonly fraction: string;
}

const partsOf = (text: string): Parts => {
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const point = unsigned.indexOf('.');

  return point === -1
    ? { negative, integer: unsigned, fraction: '' }
    : { negative, integer: unsigned.slice(0, point), fraction: unsigned.slice(point + 1) };
};

// The digits of the number as an integer, after moving the point `scale` places to the right.
const scaled = ({ negative, integer, fraction }: Parts, scale: number): bigint => {
  // @throws-ignore the parts come from text the type's pattern accepted, so they are digits
  const digits = BigInt(integer + fraction.padEnd(scale, '0'));

  return negative ? -digits : digits;
};

const canonicalText = (text: string): string => {
  const shorter = text.includes('.') ? text.replace(trailingZeros, '') : text;

  return shorter === '-0' ? '0' : shorter;
};

/**
 * Refuses a scale that is not a whole number from 0 up.
 *
 * @throws {@link RangeError} when the scale is not a whole number from 0 up.
 *
 * @internal
 */
const checkScale = (method: string, scale: number): void => {
  if (!Number.isSafeInteger(scale) || scale < 0) {
    throw new RangeError(`${method}: the scale must be a whole number from 0 up (was ${scale})`);
  }
};

/**
 * The decimal text of `amount` divided by ten to the power of `scale`, with exactly
 * `scale` digits after the point.
 *
 * @internal
 */
export const decimalText = (amount: bigint, scale: number): string => {
  const negative = amount < 0n;
  const digits = (negative ? -amount : amount).toString().padStart(scale + 1, '0');
  const integer = digits.slice(0, digits.length - scale);
  const fraction = scale === 0 ? '' : `.${digits.slice(digits.length - scale)}`;

  return `${negative ? '-' : ''}${integer}${fraction}`;
};

/**
 * An exact decimal number written as text, such as `'12.34'`, for amounts of money and other
 * numbers that must not pass through a binary float.
 *
 * @remarks
 * The grammar is a JSON number without an exponent: an optional `-`, an integer part without
 * leading zeros, and an optional `.` followed by at least one digit. `+`, `.5`, `5.`, `1e3`,
 * spaces and digits outside ASCII are refused. At most 100 characters. The text is kept as written:
 * `'1.50'` keeps its zero, and `'-0'` passes. `equals()` and `compare()` read the number, so
 * `'1.5'` equals `'1.50'`, and `canonical()` gives the shortest text.
 *
 * @example
 * ```ts
 * import { DecimalString } from '@horizon-republic/nominal-types';
 *
 * const price = new DecimalString('12.50');
 * price.toMinorUnits(2); // 1250n
 * DecimalString.fromMinorUnits(1250n, 2).value; // '12.50'
 * ```
 */
export class DecimalString extends DecimalStringBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof DecimalString>;

  /**
   * The grammar with the length limit, in a form JavaScript runs.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The number `amount / 10^scale`, written with exactly `scale` digits after the point, such as
   * `12.50` for `1250n` and 2: the way back from `toMinorUnits()`.
   *
   * @typeParam Type - The class it is called on, `DecimalString` or a subclass.
   * @param amount - The number in minor units, such as cents.
   * @param scale - How many digits go after the point.
   * @returns An instance of the class it is called on.
   * @throws {@link RangeError} when the scale is not a whole number from 0 up.
   * @throws {@link NominalError} when the text is longer than 100 characters, or the class refuses
   * it.
   */
  public static fromMinorUnits<Type extends new (input: string) => DecimalString>(
    this: Type,
    amount: bigint,
    scale: number,
  ): InstanceType<Type> {
    checkScale('fromMinorUnits()', scale);

    // A class built from a nominal type makes instances of itself.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return new this(decimalText(amount, scale)) as InstanceType<Type>;
  }

  /**
   * `-1` below zero, `1` above it and `0` for zero, `-0` included.
   */
  public get sign(): -1 | 0 | 1 {
    const { negative, integer, fraction } = partsOf(this.value);

    if (integer === '0' && /^0*$/u.test(fraction)) {
      return 0;
    }

    return negative ? -1 : 1;
  }

  /**
   * How many digits stand before the point, as written: 1 for `'0.5'`.
   */
  public get integerDigits(): number {
    return partsOf(this.value).integer.length;
  }

  /**
   * How many digits stand after the point, as written: 2 for `'1.50'`, 0 for `'7'`.
   */
  public get fractionDigits(): number {
    return partsOf(this.value).fraction.length;
  }

  /**
   * The number times `10^scale`, as a bigint: `1250n` for `'12.5'` and 2, the count of cents.
   *
   * @param scale - How many digits after the point the minor unit stands for.
   * @returns The number in minor units.
   * @throws {@link RangeError} when the scale is not a whole number from 0 up, or when the number
   * has digits other than zero past `scale` places after the point, which would be lost.
   */
  public toMinorUnits(scale: number): bigint {
    checkScale('toMinorUnits()', scale);

    const parts = partsOf(this.value);

    if (!/^0*$/u.test(parts.fraction.slice(scale))) {
      throw new RangeError(
        `toMinorUnits(): ${this.value} has more than ${scale} digits after the point`,
      );
    }

    return scaled({ ...parts, fraction: parts.fraction.slice(0, scale) }, scale);
  }

  /**
   * `-1` if this number is smaller than the other, `1` if larger, `0` if they are equal, read
   * exactly from the digits; it suits `Array.prototype.sort()`.
   *
   * @param other - The number to compare with.
   * @returns The order of the two numbers.
   */
  public compare(other: DecimalString): -1 | 0 | 1 {
    const left = partsOf(this.value);
    const right = partsOf(other.value);
    const scale = Math.max(left.fraction.length, right.fraction.length);
    const difference = scaled(left, scale) - scaled(right, scale);

    if (difference === 0n) {
      return 0;
    }

    return difference < 0n ? -1 : 1;
  }

  /**
   * The shortest text of the same number: trailing zeros after the point dropped, the point too
   * when nothing follows it, and `-0` written `0`.
   *
   * @returns A number of the same class.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public canonical(): this {
    return sameType(this, canonicalText(this.value));
  }

  /**
   * Whether the other value is the same number, however many trailing zeros either has, and
   * belongs to this type, a type under it or the type it is under, like `equals()` on every type.
   *
   * @param other - The value to compare with.
   * @returns `true` when both are the same number.
   */
  public override equals(other: unknown): boolean {
    return other instanceof DecimalString
      ? inOneLine(this, other) && canonicalText(other.value) === canonicalText(this.value)
      : super.equals(other);
  }
}

const decimalEqualityKey: EqualityKey = {
  equals: Reflect.get(DecimalString.prototype, 'equals'),
  key: ({ value }) => canonicalText(String(value)),
};

Object.defineProperty(DecimalString.prototype, equalityKeySlot, { value: decimalEqualityKey });
