import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { passesLuhnCheck } from './check-digits.ts';

const pattern = /^[A-Z]{2}[\dA-Z]{9}\d$/u;

const isIsinText = (value: unknown): value is string =>
  typeof value === 'string' && pattern.test(value) && passesLuhnCheck(value);

const IsinBase: SubtypeOf<typeof AnyString, 'nominal.Isin'> = AnyString.subtype(
  'nominal.Isin',
  stringOnly(
    satisfying(isIsinText, 'an ISIN with a valid check digit', {
      type: 'string',
      pattern: pattern.source,
      minLength: 12,
      maxLength: 12,
      examples: ['US0378331005'],
    }),
  ),
);

/**
 * An International Securities Identification Number of ISO 6166, which names a share, a bond or
 * another security, such as `US0378331005`: a two-letter prefix, nine letters or digits, and a
 * check digit.
 *
 * @remarks
 * Upper case only, as ISO 6166 writes it. The check digit is the Luhn digit of the text with each
 * letter written as two digits, `A` as 10 to `Z` as 35. The prefix is the ISO 3166-1 code of the
 * country that assigned the number, or a code such as `XS` for securities cleared across borders,
 * so it is not checked against the list of countries.
 *
 * @example
 * ```ts
 * const isin = new Isin('US0378331005');
 * isin.prefix; // 'US'
 * isin.nsin; // '037833100'
 * ```
 */
export class Isin extends IsinBase {
  /**
   * The shape of an ISIN, which the JSON Schema carries; the check digit is checked apart from it.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The two letters in front: the country that assigned the number, or a code such as `XS`.
   */
  public get prefix(): string {
    return this.value.slice(0, 2);
  }

  /**
   * The nine characters between the prefix and the check digit: the national number, such as a
   * CUSIP in the United States.
   */
  public get nsin(): string {
    return this.value.slice(2, 11);
  }
}
