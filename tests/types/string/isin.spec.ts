import { describe, expect, it } from 'vitest';

import { Isin, NominalError } from '../../../src/index.ts';
import { disagreementsOf } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';

const digits = '0123456789'.split('');

const changedAt = (text: string, index: number): string[] =>
  digits
    .filter((digit) => digit !== text.charAt(index))
    .map((digit) => text.slice(0, index) + digit + text.slice(index + 1));

describe('Isin', () => {
  it.each([
    'US0378331005',
    'AU0000XVGZA3',
    'GB0002634946',
    'DE000BAY0017',
    'XS2021832634',
    'NL0000729408',
    'JP3633400001',
  ])('accepts %s', (text) => {
    expect(new Isin(text).value).toBe(text);
  });

  it.each([
    ['a wrong check digit', 'US0378331006'],
    ['lower case', 'us0378331005'],
    ['mixed case', 'Au0000xvgza3'],
    ['a letter as the check digit', 'US037833100A'],
    ['a digit in the prefix', 'U10378331005'],
    ['eleven characters', 'US037833100'],
    ['thirteen characters', 'US03783310050'],
    ['a space', 'US 0378331005'],
    ['a hyphen', 'US-037833100-5'],
    ['empty', ''],
  ])('rejects %s', (_, text) => {
    expect(() => new Isin(text)).toThrow(NominalError);
  });

  it.each([42, null, undefined, {}, [], new Object('US0378331005')])('rejects %o', (input) => {
    expect(Isin.parse(input).ok).toBe(false);
  });

  it('names the check digit in its message', () => {
    expect(Isin.parse('US0378331006')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be an ISIN with a valid check digit (was "US0378331006")' }],
    });
  });

  it.each(['US0378331005', 'AU0000XVGZA3', 'DE000BAY0017'])(
    'refuses every other check digit of %s',
    (text) => {
      expect(changedAt(text, 11).filter((other) => Isin.parse(other).ok)).toStrictEqual([]);
    },
  );

  it('refuses every changed digit', () => {
    const text = 'US0378331005';
    const wrong = Array.from(text.slice(2), (_, index) => changedAt(text, index + 2)).flat();

    expect(wrong.filter((other) => Isin.parse(other).ok)).toStrictEqual([]);
  });

  it('refuses long crafted input quickly', () => {
    const started = performance.now();

    expect(Isin.parse(`US${'0'.repeat(100_000)}`).ok).toBe(false);
    expect(Isin.parse('A'.repeat(100_000)).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('reads its parts', () => {
    const isin = new Isin('XS2021832634');

    expect(isin.prefix).toBe('XS');
    expect(isin.nsin).toBe('202183263');
  });
});

// Whether another last character makes the text a valid ISIN.
const fixed = (text: string): boolean =>
  digits.some((check) => Isin.parse(text.slice(0, -1) + check).ok);

describe('Isin as JSON Schema', () => {
  const texts = randomTexts(['US', 'XS', 'u', '0', '3', 'A', '-', '0378', '100', '55'], 20_000, 6);

  it('describes its shape', () => {
    expect(Isin['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      type: 'string',
      pattern: Isin.pattern.source,
      minLength: 12,
      maxLength: 12,
    });
  });

  // A pattern cannot compute a check digit, so the schema accepts a wrong one.
  it('agrees with the type on generated text, apart from check digits', () => {
    const disagreements = disagreementsOf(Isin, texts);

    expect(disagreements.filter((text) => Isin.parse(text).ok)).toStrictEqual([]);
    expect(disagreements.filter((text) => !fixed(text))).toStrictEqual([]);
  });

  it('finds both answers among the generated text', () => {
    expect(texts.filter((text) => Isin.parse(text).ok).length).toBeGreaterThan(5);
    expect(disagreementsOf(Isin, texts).length).toBeGreaterThan(20);
  });
});
