import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

import { callingCodes } from '../types/string/calling-codes.ts';
import { countryCodes } from '../types/string/country-code.ts';
import { ibanCheckDigits, ibanRegistry } from '../types/string/iban-registry.ts';
import { base64UrlOf } from './built-in-text.ts';
import { alphabets, characters } from './characters.ts';

const upperAlphanumeric = `${alphabets.upper}${alphabets.digits}`;

// `+`, an assigned country calling code, and the rest of the 15 digits E.164 allows, one at least.
const e164PhoneNumber = fc
  .constantFrom(...callingCodes)
  .chain((code) =>
    characters(alphabets.digits, 1, 15 - code.length).map((rest) => `+${code}${rest}`),
  );

const bbanAlphabets: Readonly<Record<string, string>> = {
  n: alphabets.digits,
  a: alphabets.upper,
  c: upperAlphanumeric,
};

// The BBAN of a country as its registry format reads, `4a6n8n` as four letters and 14 digits.
const bbanOf = (format: string): Arbitrary<string> =>
  fc
    .tuple(
      ...Array.from(format.matchAll(/(\d+)([acn])/gu), ([, count, kind]) =>
        characters(bbanAlphabets[kind ?? 'n'] ?? alphabets.digits, Number(count)),
      ),
    )
    .map((parts) => parts.join(''));

const iban = fc
  .constantFrom(...Object.entries(ibanRegistry))
  .chain(([country, format]) =>
    bbanOf(format).map((bban) => `${country}${ibanCheckDigits(country, bban)}${bban}`),
  );

// An institution, a country `CountryCode` accepts, a location and, now and then, a branch.
const bic = fc
  .tuple(
    characters(alphabets.upper, 4),
    fc.constantFrom(...countryCodes),
    characters(upperAlphanumeric, 2),
    fc.option(characters(upperAlphanumeric, 3), { nil: '' }),
  )
  .map((parts) => parts.join(''));

const encoder = new TextEncoder();

const jsonPart = (value: unknown): string => base64UrlOf(encoder.encode(JSON.stringify(value)));

const numericDate = fc.oneof(
  fc.integer({ min: 0, max: 4_102_444_800 }),
  fc.double({ min: 0, max: 4_102_444_800, noNaN: true }),
);

const header = fc.record(
  {
    alg: fc.oneof(
      fc.constantFrom('HS256', 'RS256', 'ES256', 'PS512', 'EdDSA', 'none'),
      characters(alphabets.alphanumeric, 1, 12),
    ),
    typ: fc.constant('JWT'),
    kid: characters(alphabets.alphanumeric, 1, 16),
  },
  { requiredKeys: ['alg'] },
);

const claims = fc.record(
  {
    sub: fc.string({ maxLength: 20 }),
    iss: fc.string({ maxLength: 20 }),
    exp: numericDate,
    nbf: numericDate,
    iat: numericDate,
    scope: fc.array(fc.string({ maxLength: 8 }), { maxLength: 4 }),
  },
  { requiredKeys: [] },
);

// Now and then a long claim, so tokens up to the 8,192 characters `Jwt` takes come up as well.
const payload = fc.oneof(
  { arbitrary: claims, weight: 9 },
  {
    arbitrary: fc
      .tuple(claims, fc.nat({ max: 6000 }))
      .map(([fields, length]) => Object.assign({}, fields, { pad: 'x'.repeat(length) })),
    weight: 1,
  },
);

const signature = fc.uint8Array({ minLength: 1, maxLength: 64 }).map((bytes) => base64UrlOf(bytes));

// The signature is empty exactly when `alg` is `none`, as `Jwt` requires.
const jwt = fc
  .tuple(header, payload, signature)
  .map(
    ([fields, claimsSet, signed]) =>
      `${jsonPart(fields)}.${jsonPart(claimsSet)}.${fields.alg === 'none' ? '' : signed}`,
  )
  .filter((text) => text.length <= 8192);

/**
 * Internal: generators for the built-in codes whose rule reads a table or decodes the text: phone
 * numbers, IBANs, BICs and JWTs.
 */
export const codeArbitraries: Readonly<Record<string, () => Arbitrary<unknown>>> = {
  'nominal.E164PhoneNumber': () => e164PhoneNumber,
  'nominal.Iban': () => iban,
  'nominal.Bic': () => bic,
  'nominal.Jwt': () => jwt,
};
