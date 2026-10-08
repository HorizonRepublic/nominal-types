import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';

/**
 * Internal: the 249 officially assigned code elements of ISO 3166-1 alpha-2, and XK.
 *
 * @remarks
 * As the ISO 3166 Maintenance Agency lists them on 8 October 2026 (the last one added was SS, in
 * 2011), and XK, the code the European Union, banks and payment providers use for Kosovo. Reserved
 * codes such as UK and EU are not assigned to a country and stay out.
 */
export const countryCodes: readonly string[] = Object.freeze(
  [
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ',
    'BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ',
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ',
    'DE DJ DK DM DO DZ',
    'EC EE EG EH ER ES ET',
    'FI FJ FK FM FO FR',
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY',
    'HK HM HN HR HT HU',
    'ID IE IL IM IN IO IQ IR IS IT',
    'JE JM JO JP',
    'KE KG KH KI KM KN KP KR KW KY KZ',
    'LA LB LC LI LK LR LS LT LU LV LY',
    'MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ',
    'NA NC NE NF NG NI NL NO NP NR NU NZ',
    'OM',
    'PA PE PF PG PH PK PL PM PN PR PS PT PW PY',
    'QA',
    'RE RO RS RU RW',
    'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ',
    'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ',
    'UA UG UM US UY UZ',
    'VA VC VE VG VI VN VU',
    'WF WS',
    'XK',
    'YE YT',
    'ZA ZM ZW',
  ].flatMap((row) => row.split(' ')),
);

const assigned = new Set(countryCodes);

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const regionalIndicatorA = 0x1_f1_e6;

const isCountryCode = (value: unknown): value is string =>
  typeof value === 'string' && assigned.has(value);

const CountryCodeBase: SubtypeOf<typeof AnyString, 'nominal.CountryCode'> = AnyString.subtype(
  'nominal.CountryCode',
  stringOnly(
    satisfying(isCountryCode, 'an ISO 3166-1 alpha-2 country code', {
      type: 'string',
      enum: countryCodes,
      minLength: 2,
      maxLength: 2,
      examples: ['US'],
    }),
  ),
);

/**
 * A country, territory or area as its two-letter ISO 3166-1 code, such as `US` or `DE`.
 *
 * @remarks
 * Only the officially assigned codes pass, in upper case, from a table the package carries rather
 * than the runtime's locale data. `XK` for Kosovo passes too. Reserved codes are refused: `UK` (write
 * `GB`) and `EU`.
 * Declare a type of your own from `CountryCode.codes` where one of them has to pass.
 *
 * @example
 * ```ts
 * const country = new CountryCode('UA');
 * country.flag; // '🇺🇦'
 * ```
 */
export class CountryCode extends CountryCodeBase {
  declare public static readonly '~standard': StandardOf<typeof CountryCode>;

  /**
   * Every code the type accepts, in alphabetical order.
   */
  public static readonly codes: readonly string[] = countryCodes;

  /**
   * The flag emoji, written as the two regional indicator symbols for the code.
   */
  public get flag(): string {
    return String.fromCodePoint(
      ...Array.from(this.value, (letter) => regionalIndicatorA + alphabet.indexOf(letter)),
    );
  }
}
