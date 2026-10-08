import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { inOneLine } from '../../core/same-value.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { CountryCode } from './country-code.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';

const pattern = /^[A-Z]{4}[A-Z]{2}[\dA-Z]{2}(?:[\dA-Z]{3})?$/u;

const countries = new Set(CountryCode.codes);

const primaryOffice = 'XXX';

const isBicText = (value: unknown): value is string =>
  typeof value === 'string' && pattern.test(value) && countries.has(value.slice(4, 6));

const BicBase: SubtypeOf<typeof AnyString, 'nominal.Bic', string, typeof NonBlankString> =
  AnyString.subtype(
    'nominal.Bic',
    stringOnly(
      satisfying(isBicText, 'a BIC', {
        type: 'string',
        pattern: pattern.source,
        minLength: 8,
        maxLength: 11,
        examples: ['DEUTDEFF', 'DEUTDEFF500'],
      }),
    ),
    { implies: [nonBlankString] },
  );

const elevenOf = (text: string): string => (text.length === 8 ? text + primaryOffice : text);

/**
 * A Business Identifier Code of ISO 9362, the SWIFT code of a bank, such as `DEUTDEFF` or
 * `DEUTDEFF500`: four letters for the institution, the country, two letters or digits for the
 * location, and an optional branch of three.
 *
 * @remarks
 * Upper case only, as ISO 9362 writes it. The country must be one `CountryCode` accepts, `XK`
 * included. Whether SWIFT has issued the code is not known. A BIC of 8 characters names the primary
 * office, the same as the branch `XXX`: `equals` holds between `DEUTDEFF` and `DEUTDEFFXXX`, and
 * `canonical()` gives the 11 characters.
 *
 * @example
 * ```ts
 * import { Bic } from '@horizon-republic/nominal-types';
 *
 * const bic = new Bic('DEUTDEFF');
 * bic.countryCode; // 'DE'
 * bic.canonical().value; // 'DEUTDEFFXXX'
 * ```
 */
export class Bic extends BicBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Bic>;

  /**
   * The shape of a BIC, which the JSON Schema carries; the country is checked apart from it.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The first four letters, which name the bank or other institution.
   */
  public get institution(): string {
    return this.value.slice(0, 4);
  }

  /**
   * The ISO 3166-1 code of the country the institution is in.
   */
  public get countryCode(): string {
    return this.value.slice(4, 6);
  }

  /**
   * The two letters or digits after the country, which name the place within it.
   */
  public get location(): string {
    return this.value.slice(6, 8);
  }

  /**
   * The last three characters, which name the branch; `'XXX'`, the primary office, for a BIC of 8.
   */
  public get branch(): string {
    return this.value.length === 8 ? primaryOffice : this.value.slice(8);
  }

  /**
   * Whether the code names the primary office: 8 characters, or the branch `XXX`.
   */
  public get isPrimaryOffice(): boolean {
    return this.branch === primaryOffice;
  }

  /**
   * The 11-character form, with `XXX` for the primary office, so one office has one text.
   *
   * @returns A BIC of the same class, 11 characters long.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public canonical(): this {
    return sameType(this, elevenOf(this.value));
  }

  /**
   * Whether the other value names the same office, with 8 or 11 characters, and belongs to this
   * type, a type under it or the type it is under, like `equals()` on every type.
   *
   * @param other - The value to compare with.
   * @returns `true` when both name the same office.
   */
  public override equals(other: unknown): boolean {
    return other instanceof Bic
      ? inOneLine(this, other) && elevenOf(other.value) === elevenOf(this.value)
      : super.equals(other);
  }
}
