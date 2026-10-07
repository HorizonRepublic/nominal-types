import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { inOneLine } from '../../core/same-value.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { hasGs1CheckDigit } from './check-digits.ts';

const pattern = /^(?:\d{8}|\d{12,14})$/u;

const isGtinText = (value: unknown): value is string =>
  typeof value === 'string' && pattern.test(value) && hasGs1CheckDigit(value);

const GtinBase: SubtypeOf<typeof AnyString, 'nominal.Gtin'> = AnyString.subtype(
  'nominal.Gtin',
  stringOnly(
    satisfying(isGtinText, 'a GTIN with a valid check digit', {
      type: 'string',
      pattern: pattern.source,
      minLength: 8,
      maxLength: 14,
      examples: ['4006381333931'],
    }),
  ),
);

const gtin14Of = (text: string): string => text.padStart(14, '0');

/**
 * A Global Trade Item Number of the GS1 General Specifications, the number under a product's bar
 * code: a GTIN-8, GTIN-12 (UPC-A), GTIN-13 (EAN-13) or GTIN-14, such as `4006381333931`.
 *
 * @remarks
 * Digits only, 8, 12, 13 or 14 of them, the last one the check digit of §7.9.1. The value keeps
 * the length it was given. A shorter GTIN is the same number as the GTIN-14 with zeros in front,
 * so `equals` compares the GTIN-14 forms and `canonical()` gives one. The check digit is all that
 * is checked: all zeros passes, and so does a number GS1 never assigned.
 *
 * @example
 * ```ts
 * const gtin = new Gtin('036000291452');
 * gtin.format; // 12
 * gtin.canonical().value; // '00036000291452'
 * ```
 */
export class Gtin extends GtinBase {
  /**
   * The shape of a GTIN, which the JSON Schema carries; the check digit is checked apart from it.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The number of digits as given: 8, 12, 13 or 14.
   */
  public get format(): 8 | 12 | 13 | 14 {
    const { length } = this.value;

    if (length === 8 || length === 12 || length === 13) {
      return length;
    }

    return 14;
  }

  /**
   * The GTIN-14 form, with zeros in front, as GS1 asks a database to keep a GTIN.
   */
  public canonical(): Gtin {
    return new Gtin(gtin14Of(this.value));
  }

  /**
   * Whether the other value is the same number, whatever its length, and belongs to this type, a
   * type under it or the type it is under, like `equals()` on every type.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) &&
      other instanceof Gtin &&
      gtin14Of(other.value) === gtin14Of(this.value)
    );
  }
}
