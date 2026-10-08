import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { AnyString, Isbn, NominalError } from '../../../src/index.ts';
import { disagreementsOf } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

const checkCharacters = '0123456789X'.split('');

// The text with each other character in place of the one at the index.
const changedAt = (text: string, index: number, characters: readonly string[]): string[] =>
  characters
    .filter((character) => character !== text.charAt(index))
    .map((character) => text.slice(0, index) + character + text.slice(index + 1));

describe('Isbn', () => {
  it.each([
    ['0-306-40615-2', 'must be an ISBN without hyphens or spaces (was "0-306-40615-2")'],
    ['978 0 306 40615 7', 'must be an ISBN without hyphens or spaces (was "978 0 306 40615 7")'],
    [' 9780306406157', 'must be an ISBN without hyphens or spaces (was " 9780306406157")'],
    ['9780306406158', 'must be an ISBN with a valid check digit (was "9780306406158")'],
    ['978030640615', 'must be an ISBN with a valid check digit (was "978030640615")'],
    ['9780306406157\t', 'must be an ISBN without hyphens or spaces (was "9780306406157\\t")'],
    ['ISBN9780306406157', 'must be an ISBN with a valid check digit (was "ISBN9780306406157")'],
    [
      '0-306-40615-2'.repeat(10),
      `must be an ISBN without hyphens or spaces (was a string of 130 characters starting "${'0-306-40615-2'.repeat(3).slice(0, 32)}"…)`,
    ],
  ])('says why it refuses %j', (text, message) => {
    expect(Isbn.parse(text)).toStrictEqual({ ok: false, issues: [{ message }] });
  });

  it.each([
    '9780306406157',
    '0306406152',
    '080442957X',
    '9791090636071',
    '9798886451740',
    '0000000000',
    '9780000000002',
  ])('accepts %s as given', (text) => {
    expect(new Isbn(text).value).toBe(text);
  });

  it.each([
    ['nine digits', '030640615'],
    ['eleven digits', '03064061520'],
    ['twelve digits', '978030640615'],
    ['fourteen digits', '97803064061570'],
    ['a wrong ISBN-10 check digit', '0306406153'],
    ['a wrong ISBN-13 check digit', '9780306406158'],
    ['a lowercase x', '080442957x'],
    ['an X inside', '03064X6152'],
    ['an X closing an ISBN-13', '978030640615X'],
    ['an ISBN-13 without 978 or 979', '9770306406154'],
    ['an ISMN, 979-0', '9790060115615'],
    ['hyphens', '0-306-40615-2'],
    ['the hyphenated ISBN-13', '978-0-306-40615-7'],
    ['spaces', '978 0 306 40615 7'],
    ['the ISBN prefix', 'ISBN 9780306406157'],
    ['a space around it', ' 9780306406157'],
    ['full-width digits', '９７８０３０６４０６１５７'],
    ['empty', ''],
  ])('rejects %s', (_, text) => {
    expect(() => new Isbn(text)).toThrow(NominalError);
  });

  it.each([42, 9_780_306_406_157, null, undefined, {}, [], new Object('9780306406157')])(
    'rejects %o',
    (input) => {
      expect(Isbn.parse(input).ok).toBe(false);
    },
  );

  it('names the check digit in its message', () => {
    expect(Isbn.parse('9780306406158')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be an ISBN with a valid check digit (was "9780306406158")' }],
    });
  });

  it.each(['9780306406157', '0306406152', '080442957X'])(
    'refuses every other check character of %s',
    (text) => {
      const wrong = changedAt(text, text.length - 1, checkCharacters);

      expect(wrong.filter((other) => Isbn.parse(other).ok)).toStrictEqual([]);
    },
  );

  it.each(['9780306406157', '0306406152'])('refuses every changed digit of %s', (text) => {
    const wrong = Array.from(text, (_, index) =>
      changedAt(text, index, checkCharacters.slice(0, 10)),
    ).flat();

    expect(wrong.filter((other) => Isbn.parse(other).ok)).toStrictEqual([]);
  });

  it('refuses the separators validator.js isISBN strips (VJS #2542)', () => {
    expect(Isbn.parse('978--0306 40615-7').ok).toBe(false);
    expect(Isbn.parse('978-0306-40615-7').ok).toBe(false);
    expect(Isbn.parse('9780306406157').ok).toBe(true);
  });

  it('refuses long crafted input quickly', () => {
    const started = performance.now();

    expect(Isbn.parse('9'.repeat(100_000)).ok).toBe(false);
    expect(Isbn.parse(`978${'0'.repeat(100_000)}`).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('tells the two formats apart', () => {
    expect(new Isbn('0306406152').format).toBe(10);
    expect(new Isbn('9780306406157').format).toBe(13);
  });

  it.each([
    ['0306406152', '9780306406157'],
    ['080442957X', '9780804429573'],
    ['9780306406157', '9780306406157'],
    ['9791090636071', '9791090636071'],
  ])('gives the ISBN-13 of %s as its canonical form', (text, isbn13) => {
    expect(new Isbn(text).canonical()).toStrictEqual(new Isbn(isbn13));
  });

  it.each([
    ['9780306406157', '0306406152'],
    ['9780804429573', '080442957X'],
    ['0306406152', '0306406152'],
  ])('gives the ISBN-10 of %s', (text, isbn10) => {
    expect(new Isbn(text).toIsbn10()).toStrictEqual(new Isbn(isbn10));
  });

  it('has no ISBN-10 for a 979 ISBN', () => {
    expect(new Isbn('9791090636071').toIsbn10()).toBeUndefined();
  });

  it('turns every ISBN-10 into an ISBN-13 and back', () => {
    const isbn10s = Array.from({ length: 1000 }, (_, index) => {
      const body = String(index * 999_331).padStart(9, '0');

      return checkCharacters.map((check) => body + check).find((text) => Isbn.parse(text).ok);
    });

    for (const text of isbn10s) {
      const isbn = new Isbn(String(text));

      expect(isbn.canonical().toIsbn10()).toStrictEqual(isbn);
    }
  });

  it('finds an ISBN-10 equal to its ISBN-13, also from another copy', async () => {
    const copy = await anotherCopy();

    expect(new Isbn('0306406152').equals(new Isbn('9780306406157'))).toBe(true);
    expect(new Isbn('9780306406157').equals(new copy.Isbn('0306406152'))).toBe(true);
    expect(new Isbn('9780306406157').equals(new Isbn('9791090636071'))).toBe(false);
    expect(new Isbn('9780306406157').equals('9780306406157')).toBe(false);
    expect(new Isbn('9780306406157').equals(new AnyString('9780306406157'))).toBe(true);
    expect(new Isbn('9780306406157').equals(new AnyString('0306406152'))).toBe(false);
  });
});

// Whether another last character makes the text a valid ISBN.
const fixed = (text: string): boolean =>
  checkCharacters.some((check) => Isbn.parse(text.slice(0, -1) + check).ok);

describe('Isbn as JSON Schema', () => {
  const texts = randomTexts(
    ['0', '1', '3', '5', '7', '8', '9', '978', '979', '9790', 'X', 'x', '-', '0306'],
    20_000,
    9,
  );

  it('describes its shape', () => {
    expect(Isbn['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      type: 'string',
      pattern: Isbn.pattern.source,
      minLength: 10,
      maxLength: 13,
    });
  });

  // A pattern cannot compute a check digit, so the schema accepts a wrong one.
  it('agrees with the type on generated text, apart from check digits', () => {
    const disagreements = disagreementsOf(Isbn, texts);

    expect(disagreements.filter((text) => Isbn.parse(text).ok)).toStrictEqual([]);
    expect(disagreements.filter((text) => !fixed(text))).toStrictEqual([]);
  });

  it('finds both answers among the generated text', () => {
    expect(texts.filter((text) => Isbn.parse(text).ok).length).toBeGreaterThan(20);
    expect(disagreementsOf(Isbn, texts).length).toBeGreaterThan(20);
  });
});
