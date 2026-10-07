import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { Gtin, NominalError } from '../../../src/index.ts';
import { disagreementsOf } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

const digits = '0123456789'.split('');

const changedAt = (text: string, index: number): string[] =>
  digits
    .filter((digit) => digit !== text.charAt(index))
    .map((digit) => text.slice(0, index) + digit + text.slice(index + 1));

describe('Gtin', () => {
  it.each([
    ['a GTIN-8', '96385074', 8],
    ['a GTIN-12', '036000291452', 12],
    ['a GTIN-13', '4006381333931', 13],
    ['a GTIN-14', '10012345000017', 14],
    ['an ISBN-13', '9780306406157', 13],
    ['the GTIN-14 of a GTIN-12', '00036000291452', 14],
  ])('accepts %s', (_, text, format) => {
    const gtin = new Gtin(text);

    expect(gtin.value).toBe(text);
    expect(gtin.format).toBe(format);
  });

  it.each([
    ['seven digits', '9638507'],
    ['nine digits', '963850740'],
    ['ten digits', '0306406152'],
    ['eleven digits', '03600029145'],
    ['fifteen digits', '100123450000170'],
    ['a wrong check digit', '4006381333932'],
    ['a space', '4006381 333931'],
    ['a hyphen', '400-6381333931'],
    ['a letter', '400638133393A'],
    ['a sign', '+4006381333931'],
    ['empty', ''],
  ])('rejects %s', (_, text) => {
    expect(() => new Gtin(text)).toThrow(NominalError);
  });

  it.each([4_006_381_333_931, 4_006_381_333_931n, null, undefined, {}, [], new Object('96385074')])(
    'rejects %o',
    (input) => {
      expect(Gtin.parse(input).ok).toBe(false);
    },
  );

  it('names the check digit in its message', () => {
    expect(Gtin.parse('4006381333932')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be a GTIN with a valid check digit (was "4006381333932")' }],
    });
  });

  it.each(['96385074', '036000291452', '4006381333931', '10012345000017'])(
    'refuses every changed digit of %s',
    (text) => {
      const wrong = Array.from(text, (_, index) => changedAt(text, index)).flat();

      expect(wrong.filter((other) => Gtin.parse(other).ok)).toStrictEqual([]);
    },
  );

  it('accepts all zeros, which pass the check digit, as validator.js isEAN does', () => {
    expect(Gtin.parse('00000000').ok).toBe(true);
    expect(Gtin.parse('0000000000000').ok).toBe(true);
  });

  it('refuses long crafted input quickly', () => {
    const started = performance.now();

    expect(Gtin.parse('0'.repeat(100_000)).ok).toBe(false);
    expect(Gtin.parse(`${'0'.repeat(100_000)}x`).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it.each([
    ['96385074', '00000096385074'],
    ['036000291452', '00036000291452'],
    ['4006381333931', '04006381333931'],
    ['10012345000017', '10012345000017'],
  ])('gives the GTIN-14 of %s as its canonical form', (text, gtin14) => {
    expect(new Gtin(text).canonical()).toStrictEqual(new Gtin(gtin14));
  });

  it('compares the number, whatever its length', async () => {
    const copy = await anotherCopy();

    expect(new Gtin('036000291452').equals(new Gtin('0036000291452'))).toBe(true);
    expect(new Gtin('036000291452').equals(new Gtin('00036000291452'))).toBe(true);
    expect(new Gtin('036000291452').equals(new copy.Gtin('00036000291452'))).toBe(true);
    expect(new Gtin('036000291452').equals(new Gtin('4006381333931'))).toBe(false);
    expect(new Gtin('036000291452').equals('036000291452')).toBe(false);
  });
});

// Whether another last character makes the text a valid GTIN.
const fixed = (text: string): boolean =>
  digits.some((check) => Gtin.parse(text.slice(0, -1) + check).ok);

describe('Gtin as JSON Schema', () => {
  const texts = randomTexts(['0', '1', '3', '4', '6', '9', '00', '4006', '-', 'a'], 10_000, 12);

  it('describes its shape', () => {
    expect(Gtin['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      type: 'string',
      pattern: Gtin.pattern.source,
      minLength: 8,
      maxLength: 14,
    });
  });

  // A pattern cannot compute a check digit, so the schema accepts a wrong one.
  it('agrees with the type on generated text, apart from check digits', () => {
    const disagreements = disagreementsOf(Gtin, texts);

    expect(disagreements.filter((text) => Gtin.parse(text).ok)).toStrictEqual([]);
    expect(disagreements.filter((text) => !fixed(text))).toStrictEqual([]);
  });

  it('finds both answers among the generated text', () => {
    expect(texts.filter((text) => Gtin.parse(text).ok).length).toBeGreaterThan(20);
    expect(disagreementsOf(Gtin, texts).length).toBeGreaterThan(20);
  });
});
