import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';

// ISO 4217 List One, the current currency and funds codes, as SIX, the maintenance agency,
// published it on 17 September 2026: 178 codes, grouped by minor units. The codes ISO lists with
// minor units "N.A." (precious metals, bond market units, SDR, XSU, XUA, XTS and XXX) have none.
const byMinorUnits: ReadonlyArray<readonly [number | undefined, readonly string[]]> = [
  [0, ['BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF']],
  [
    2,
    [
      'AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BMD BND BOB BOV BRL BSD BTN BWP',
      'BYN BZD CAD CDF CHE CHF CHW CNY COP COU CRC CUP CVE CZK DKK DOP DZD EGP ERN ETB',
      'EUR FJD FKP GBP GEL GHS GIP GMD GTQ GYD HKD HNL HTG HUF IDR ILS INR IRR JMD KES',
      'KGS KHR KPW KYD KZT LAK LBP LKR LRD LSL MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR',
      'MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD PAB PEN PGK PHP PKR PLN QAR RON RSD',
      'RUB SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TOP',
      'TRY TTD TWD TZS UAH USD USN UYU UZS VED VES WST XAD XCD XCG YER ZAR ZMW ZWG',
    ],
  ],
  [3, ['BHD IQD JOD KWD LYD OMR TND']],
  [4, ['CLF UYW']],
  [undefined, ['XAG XAU XBA XBB XBC XBD XDR XPD XPT XSU XTS XUA XXX']],
];

// The codes List One marks as funds rather than currencies.
const funds = new Set(['BOV', 'CHE', 'CHW', 'CLF', 'COU', 'MXV', 'USN', 'UYI', 'UYW', 'XAD']);

const minorUnitsOf: ReadonlyMap<string, number | undefined> = new Map(
  byMinorUnits.flatMap(([units, rows]) =>
    rows.flatMap((row) => row.split(' ').map((code) => [code, units] as const)),
  ),
);

const codes: readonly string[] = Object.freeze([...minorUnitsOf.keys()].toSorted());

const isCurrencyCode = (value: unknown): value is string =>
  typeof value === 'string' && minorUnitsOf.has(value);

const CurrencyCodeBase: SubtypeOf<
  typeof AnyString,
  'nominal.CurrencyCode',
  string,
  typeof NonBlankString
> = AnyString.subtype(
  'nominal.CurrencyCode',
  stringOnly(
    satisfying(isCurrencyCode, 'an ISO 4217 currency code', {
      type: 'string',
      enum: codes,
      minLength: 3,
      maxLength: 3,
      examples: ['EUR'],
    }),
  ),
  { implies: [nonBlankString] },
);

/**
 * A currency as its three-letter ISO 4217 code, such as `EUR` or `JPY`, with the number of digits
 * its amounts take after the decimal point.
 *
 * @remarks
 * Every code of List One passes, in upper case, from a table the package carries rather than the
 * runtime's locale data: currencies, funds such as `CLF`, precious metals such as `XAU`, and the
 * codes `XTS` for testing and `XXX` for no currency. Withdrawn codes such as `HRK` are refused.
 *
 * @example
 * ```ts
 * import { CurrencyCode } from '@horizon-republic/nominal-types';
 *
 * new CurrencyCode('JPY').minorUnits; // 0
 * new CurrencyCode('BHD').minorUnits; // 3
 * ```
 */
export class CurrencyCode extends CurrencyCodeBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof CurrencyCode>;

  /**
   * Every code the type accepts, in alphabetical order.
   */
  public static readonly codes: readonly string[] = codes;

  /**
   * How many digits an amount takes after the decimal point, such as 2 for `EUR` and 0 for `JPY`;
   * `undefined` for the codes ISO gives none, such as `XAU` and `XXX`.
   */
  public get minorUnits(): number | undefined {
    return minorUnitsOf.get(this.value);
  }

  /**
   * Whether List One marks the code as a fund, such as `CLF` or `USN`, rather than a currency.
   */
  public get isFund(): boolean {
    return funds.has(this.value);
  }
}
