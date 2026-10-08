import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

import {
  gs1CheckDigit,
  mod11CheckCharacter,
  passesLuhnCheck,
} from '../types/string/check-digits.ts';
import { alphabets, characters } from './characters.ts';

const digits = (count: number): Arbitrary<string> => characters(alphabets.digits, count);

const isbn10 = digits(9).map((body) => body + mod11CheckCharacter(body));

// 979-0 is the ISMN of printed music, so an ISBN-13 starts with 978 or 979-1 to 979-9.
const isbn13 = fc
  .tuple(fc.stringMatching(/^97(?:8\d|9[1-9])$/u), digits(8))
  .map(([prefix, body]) => prefix + body + gs1CheckDigit(prefix + body));

const issn = digits(7).map(
  (body) => `${body.slice(0, 4)}-${body.slice(4)}${mod11CheckCharacter(body)}`,
);

const gtin = fc
  .constantFrom(8, 12, 13, 14)
  .chain((length) => digits(length - 1))
  .map((body) => body + gs1CheckDigit(body));

const checkDigits = '0123456789';

const isin = fc
  .stringMatching(/^[A-Z]{2}[\dA-Z]{9}$/u)
  .map(
    (body) => body + (Array.from(checkDigits).find((digit) => passesLuhnCheck(body + digit)) ?? ''),
  );

const hex = (count: number): Arbitrary<string> => characters(alphabets.hex, count);

const uuidOf = (versions: string): Arbitrary<string> =>
  fc
    .tuple(
      hex(8),
      hex(4),
      characters(versions, 1),
      hex(3),
      characters('89abAB', 1),
      hex(3),
      hex(12),
    )
    .map(
      ([first, second, version, third, variant, fourth, last]) =>
        `${first}-${second}-${version}${third}-${variant}${fourth}-${last}`,
    );

const uuid = fc.oneof(
  { arbitrary: uuidOf('12345678'), weight: 30 },
  { arbitrary: fc.constant('00000000-0000-0000-0000-000000000000'), weight: 1 },
  { arbitrary: fc.mixedCase(fc.constant('ffffffff-ffff-ffff-ffff-ffffffffffff')), weight: 1 },
);

// The 25 code points with the Unicode White_Space property, as `NonBlankString` lists them.
const whiteSpace = [
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x16_80, 0x20_00, 0x20_01, 0x20_02, 0x20_03,
  0x20_04, 0x20_05, 0x20_06, 0x20_07, 0x20_08, 0x20_09, 0x20_0a, 0x20_28, 0x20_29, 0x20_2f, 0x20_5f,
  0x30_00,
].map((point) => String.fromCodePoint(point));

const blank = fc
  .array(fc.constantFrom(...whiteSpace), { maxLength: 4 })
  .map((spaces) => spaces.join(''));

const anyText = fc.oneof(fc.string(), fc.string({ unit: 'binary' }));

const nonBlank = fc
  .tuple(blank, fc.string({ unit: 'binary', minLength: 1 }), blank)
  .map((parts) => parts.join(''));

const bytes = fc.uint8Array({ maxLength: 48 });

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// RFC 4648 §4: every three bytes as four characters, padded with `=`.
const base64Of = (data: Uint8Array): string => {
  let text = '';

  for (let index = 0; index < data.length; index += 3) {
    const chunk =
      ((data[index] ?? 0) << 16) | ((data[index + 1] ?? 0) << 8) | (data[index + 2] ?? 0);
    const count = Math.min(3, data.length - index) + 1;

    for (let position = 0; position < 4; position += 1) {
      text += position < count ? (base64Alphabet[(chunk >> (18 - position * 6)) & 63] ?? '') : '=';
    }
  }

  return text;
};

/**
 * Bytes as RFC 4648 §5 base64url text, without padding.
 *
 * @internal
 */
export const base64UrlOf = (data: Uint8Array): string =>
  base64Of(data).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

/**
 * A generator for each built-in string type with a grammar or a check digit, by name.
 *
 * @internal
 */
export const textArbitraries: Readonly<Record<string, () => Arbitrary<unknown>>> = {
  'nominal.AnyString': () => anyText,
  'nominal.NonEmptyString': () => anyText.filter((text) => text !== ''),
  'nominal.NonBlankString': () => nonBlank,
  'nominal.Uuid': () => uuid,
  'nominal.UuidV4': () => uuidOf('4'),
  'nominal.UuidV7': () => uuidOf('7'),
  'nominal.Isbn': () => fc.oneof(isbn10, isbn13),
  'nominal.Issn': () => issn,
  'nominal.Gtin': () => gtin,
  'nominal.Isin': () => isin,
  'nominal.Base64': () => bytes.map((data) => base64Of(data)),
  'nominal.Base64Url': () => bytes.map((data) => base64UrlOf(data)),
};
