import { domainToASCII, domainToUnicode } from 'node:url';

import { describe, expect, it } from 'vitest';

import { decodePunycode, encodePunycode } from '../../../src/types/string/punycode.ts';

const pointsOf = (text: string): number[] =>
  Array.from(text, (character) => character.codePointAt(0) ?? 0);

describe('Punycode (RFC 3492)', () => {
  it.each(['bücher', 'münchen', 'пример', 'рф', '例え', 'ελληνικά', 'مثال', 'a-b--ü', 'ß', 'ü'])(
    'encodes and decodes %s as the WHATWG URL parser does',
    (word) => {
      const ascii = domainToASCII(word).slice(4);

      expect(encodePunycode(pointsOf(word))).toBe(ascii);
      expect(decodePunycode(ascii)).toStrictEqual(pointsOf(domainToUnicode(`xn--${ascii}`)));
    },
  );

  it.each([
    ['ends inside a number', 'b'],
    ['holds a character that is no digit', 'a_b'],
    ['holds an uppercase digit, which callers lower first', 'A'],
    ['passes 2^31 - 1', '999999999999'],
    ['passes U+10FFFF', 'hv63m'],
    ['lands on a surrogate', '1t0c'],
  ])('refuses text that %s', (_, text) => {
    expect(decodePunycode(text)).toBeUndefined();
  });

  it('keeps the basic code points before the last hyphen', () => {
    expect(decodePunycode('a-b---ova')).toStrictEqual(pointsOf('a-b--ü'));
  });

  it('decodes nothing to nothing', () => {
    expect(decodePunycode('')).toStrictEqual([]);
    expect(encodePunycode([])).toBe('');
  });
});
