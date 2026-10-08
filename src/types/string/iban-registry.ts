/**
 * Internal: the BBAN of every country in the SWIFT IBAN Registry, release 101 (current in January
 * 2026), by country code.
 *
 * @remarks
 * Written as the registry writes it: a length and `n` for digits, `a` for upper-case letters, `c`
 * for letters and digits. A territory that uses the IBAN of its country, such as GF or AX, writes
 * FR or FI in front.
 */
export const ibanRegistry: Readonly<Record<string, string>> = {
  AD: '4n4n12c',
  AE: '3n16n',
  AL: '8n16c',
  AT: '5n11n',
  AZ: '4a20c',
  BA: '3n3n8n2n',
  BE: '3n7n2n',
  BG: '4a4n2n8c',
  BH: '4a14c',
  BI: '5n5n11n2n',
  BR: '8n5n10n1a1c',
  BY: '4c4n16c',
  CH: '5n12c',
  CR: '4n14n',
  CY: '3n5n16c',
  CZ: '4n16n',
  DE: '8n10n',
  DJ: '5n5n11n2n',
  DK: '4n9n1n',
  DO: '4c20n',
  EE: '2n14n',
  EG: '4n4n17n',
  ES: '4n4n1n1n10n',
  FI: '3n11n',
  FK: '2a12n',
  FO: '4n9n1n',
  FR: '5n5n11c2n',
  GB: '4a6n8n',
  GE: '2a16n',
  GI: '4a15c',
  GL: '4n9n1n',
  GR: '3n4n16c',
  GT: '4c20c',
  HN: '4a20n',
  HR: '7n10n',
  HU: '3n4n1n15n1n',
  IE: '4a6n8n',
  IL: '3n3n13n',
  IQ: '4a3n12n',
  IS: '4n2n6n10n',
  IT: '1a5n5n12c',
  JO: '4a4n18c',
  KW: '4a22c',
  KZ: '3n13c',
  LB: '4n20c',
  LC: '4a24c',
  LI: '5n12c',
  LT: '5n11n',
  LU: '3n13c',
  LV: '4a13c',
  LY: '3n3n15n',
  MC: '5n5n11c2n',
  MD: '2c18c',
  ME: '3n13n2n',
  MK: '3n10c2n',
  MN: '4n12n',
  MR: '5n5n11n2n',
  MT: '4a5n18c',
  MU: '4a2n2n12n3n3a',
  NI: '4a20n',
  NL: '4a10n',
  NO: '4n6n1n',
  OM: '3n16c',
  PK: '4a16c',
  PL: '8n16n',
  PS: '4a21c',
  PT: '4n4n11n2n',
  QA: '4a21c',
  RO: '4a16c',
  RS: '3n13n2n',
  RU: '9n5n15c',
  SA: '2n18c',
  SC: '4a2n2n16n3a',
  SD: '2n12n',
  SE: '3n16n1n',
  SI: '5n8n2n',
  SK: '4n6n10n',
  SM: '1a5n5n12c',
  SO: '4n3n12n',
  ST: '4n4n11n2n',
  SV: '4a20n',
  TL: '3n14n2n',
  TN: '2n3n13n2n',
  TR: '5n1n16c',
  UA: '6n19c',
  VA: '3n15n',
  VG: '4a16n',
  XK: '4n10n2n',
  YE: '4a4n18c',
};

const zero = 48;
const letterA = 65;

/**
 * Internal: ISO 7064 MOD 97-10 of an IBAN with its first four characters moved to the end and each
 * letter written as two digits, `A` as 10 to `Z` as 35; 1 for valid check digits.
 *
 * @remarks
 * The remainder is carried through, so no number grows past a few digits.
 */
export const ibanRemainderOf = (text: string): number => {
  const moved = text.slice(4) + text.slice(0, 4);
  let remainder = 0;

  for (let index = 0; index < moved.length; index += 1) {
    const code = moved.codePointAt(index) ?? zero;

    remainder =
      code >= letterA
        ? (remainder * 100 + code - letterA + 10) % 97
        : (remainder * 10 + code - zero) % 97;
  }

  return remainder;
};

/**
 * Internal: the two check digits ISO 13616-1 computes for a country and a BBAN.
 */
export const ibanCheckDigits = (country: string, bban: string): string =>
  String(98 - ibanRemainderOf(`${country}00${bban}`)).padStart(2, '0');
