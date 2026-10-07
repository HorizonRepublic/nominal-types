import { describe, expect, it } from 'vitest';

import { Issn, NominalError } from '../../../src/index.ts';
import { disagreementsOf } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';

const checkCharacters = '0123456789X'.split('');

const changedAt = (text: string, index: number, characters: readonly string[]): string[] =>
  characters
    .filter((character) => character !== text.charAt(index))
    .map((character) => text.slice(0, index) + character + text.slice(index + 1));

describe('Issn', () => {
  it.each(['0378-5955', '2049-3630', '0317-8471', '2434-561X', '0000-006X', '0000-0000'])(
    'accepts %s',
    (text) => {
      expect(new Issn(text).value).toBe(text);
    },
  );

  it.each([
    ['no hyphen', '03785955'],
    ['a lowercase x', '2434-561x'],
    ['a wrong check digit', '0378-5956'],
    ['an X in the wrong place', '037X-5955'],
    ['three digits first', '378-5955'],
    ['four digits last', '0378-59555'],
    ['a space for the hyphen', '0378 5955'],
    ['a dash for the hyphen', '0378–5955'],
    ['two hyphens', '0378--5955'],
    ['the ISSN prefix', 'ISSN 0378-5955'],
    ['an eight-digit ISBN-like text', '0378595-5'],
    ['empty', ''],
  ])('rejects %s', (_, text) => {
    expect(() => new Issn(text)).toThrow(NominalError);
  });

  it.each([42, 3_785_955, null, undefined, {}, [], new Object('0378-5955')])(
    'rejects %o',
    (input) => {
      expect(Issn.parse(input).ok).toBe(false);
    },
  );

  it('names the check digit in its message', () => {
    expect(Issn.parse('0378-5956')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be an ISSN with a valid check digit (was "0378-5956")' }],
    });
  });

  it.each(['0378-5955', '2434-561X'])('refuses every other check character of %s', (text) => {
    const wrong = changedAt(text, 8, checkCharacters);

    expect(wrong.filter((other) => Issn.parse(other).ok)).toStrictEqual([]);
  });

  it('refuses every changed digit', () => {
    const wrong = [0, 1, 2, 3, 5, 6, 7, 8].flatMap((index) =>
      changedAt('0378-5955', index, checkCharacters.slice(0, 10)),
    );

    expect(wrong.filter((other) => Issn.parse(other).ok)).toStrictEqual([]);
  });

  it('decides the case of X and the hyphen once, unlike validator.js isISSN (VJS #2542)', () => {
    expect(Issn.parse('0378-595x').ok).toBe(false);
    expect(Issn.parse('03785955').ok).toBe(false);
    expect(Issn.parse('0378-5955').ok).toBe(true);
  });

  it('refuses long crafted input quickly', () => {
    const started = performance.now();

    expect(Issn.parse(`0378-${'5'.repeat(100_000)}`).ok).toBe(false);
    expect(Issn.parse('0378-'.repeat(20_000)).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });
});

// Whether another last character makes the text a valid ISSN.
const fixed = (text: string): boolean =>
  checkCharacters.some((check) => Issn.parse(text.slice(0, -1) + check).ok);

describe('Issn as JSON Schema', () => {
  const texts = randomTexts(['0', '5', 'X', 'x', '-', '0378-', '20-', '595', '55'], 20_000, 5);

  it('describes its shape', () => {
    expect(Issn['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      type: 'string',
      pattern: Issn.pattern.source,
      minLength: 9,
      maxLength: 9,
    });
  });

  // A pattern cannot compute a check digit, so the schema accepts a wrong one.
  it('agrees with the type on generated text, apart from check digits', () => {
    const disagreements = disagreementsOf(Issn, texts);

    expect(disagreements.filter((text) => Issn.parse(text).ok)).toStrictEqual([]);
    expect(disagreements.filter((text) => !fixed(text))).toStrictEqual([]);
  });

  it('finds both answers among the generated text', () => {
    expect(texts.filter((text) => Issn.parse(text).ok).length).toBeGreaterThan(5);
    expect(disagreementsOf(Issn, texts).length).toBeGreaterThan(20);
  });
});
