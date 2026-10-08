import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { ibanRegistry, ibanRemainderOf } from './iban-registry.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';
import { SeparatedRule } from './separated-rule.ts';

const bbanSourceOf = (format: string): string =>
  format
    .replaceAll(/(\d+)n/gu, '\\d{$1}')
    .replaceAll(/(\d+)a/gu, '[A-Z]{$1}')
    .replaceAll(/(\d+)c/gu, '[\\dA-Z]{$1}');

// The BBAN of each country as a pattern, `4a6n8n` as `^[A-Z]{4}\d{6}\d{8}$`.
const bbans: ReadonlyMap<string, RegExp> = new Map(
  Object.entries(ibanRegistry).map(([country, format]) => [
    country,
    new RegExp(`^${bbanSourceOf(format)}$`, 'u'),
  ]),
);

// A country code, two check digits and 11 to 30 letters or digits, as ISO 13616-1 writes an IBAN in
// electronic form; the registry narrows each country down to one length and one BBAN.
const pattern = /^[A-Z]{2}\d{2}[\dA-Z]{11,30}$/u;

const separators = /[\s-]/u;

// 00, 01 and 99 pass MOD 97-10 when 97, 98 and 02 do, but ISO 13616-1 computes check digits from
// 02 to 98 only.
const isCheckDigits = (text: string): boolean => {
  const digits = text.slice(2, 4);

  return digits !== '00' && digits !== '01' && digits !== '99';
};

const isIbanText = (value: unknown): value is string =>
  typeof value === 'string' &&
  pattern.test(value) &&
  (bbans.get(value.slice(0, 2))?.test(value.slice(4)) ?? false) &&
  isCheckDigits(value) &&
  ibanRemainderOf(value) === 1;

const IbanBase: SubtypeOf<typeof AnyString, 'nominal.Iban', string, typeof NonBlankString> =
  AnyString.subtype(
    'nominal.Iban',
    stringOnly(
      new SeparatedRule(
        isIbanText,
        'an IBAN with valid check digits',
        { separators, description: 'an IBAN without spaces' },
        {
          type: 'string',
          pattern: pattern.source,
          minLength: 15,
          maxLength: 34,
          examples: ['GB82WEST12345698765432'],
        },
      ),
    ),
    { implies: [nonBlankString], sensitive: true },
  );

/**
 * An International Bank Account Number of ISO 13616-1, such as `GB82WEST12345698765432`: a country
 * code, two check digits and the account number in that country, the BBAN.
 *
 * @remarks
 * The value is the electronic form: upper case, no spaces. The country must be in the SWIFT IBAN
 * Registry, from a table the package carries, and the length and the BBAN must have the shape the
 * registry gives that country. The check digits are checked with ISO 7064 MOD 97-10. Whether the
 * bank and the account exist is not known. Text in print form, with spaces, is refused with its own
 * message; remove the spaces before parsing. A bank account is personal data, so messages leave it
 * out.
 *
 * @example
 * ```ts
 * import { Iban } from '@horizon-republic/nominal-types';
 *
 * const iban = new Iban('GB82WEST12345698765432');
 * iban.countryCode; // 'GB'
 * iban.toPrint(); // 'GB82 WEST 1234 5698 7654 32'
 * ```
 */
export class Iban extends IbanBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Iban>;

  /**
   * Every country code the type accepts, in alphabetical order.
   */
  public static readonly countryCodes: readonly string[] = Object.freeze(Object.keys(ibanRegistry));

  /**
   * The shape of an IBAN in electronic form, which the JSON Schema carries; the length and BBAN of
   * each country and the check digits are checked apart from it.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The two letters in front: the ISO 3166-1 code of the country that keeps the account.
   */
  public get countryCode(): string {
    return this.value.slice(0, 2);
  }

  /**
   * The two digits after the country code.
   */
  public get checkDigits(): string {
    return this.value.slice(2, 4);
  }

  /**
   * The Basic Bank Account Number: everything after the check digits, the account as its country
   * writes it.
   */
  public get bban(): string {
    return this.value.slice(4);
  }

  /**
   * The print form of ISO 13616-1: groups of four characters separated by spaces, for showing to
   * people.
   *
   * @returns The IBAN in print form.
   */
  public toPrint(): string {
    return this.value.replaceAll(/.{4}(?!$)/gu, '$& ');
  }
}
