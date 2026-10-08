import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { AnyString, Bic, CountryCode, NominalError } from '../../../src/index.ts';
import { disagreementsOf, satisfiesSchema } from '../../support/json-schema.ts';
import { randomTexts } from '../../support/random-text.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../../src/index.ts');
};

describe('Bic', () => {
  it.each([
    'DEUTDEFF',
    'DEUTDEFF500',
    'DEUTDEFFXXX',
    'NWBKGB2L',
    'BNPAFRPPXXX',
    'PBNKUA2X',
    'RBKOXKPR',
  ])('accepts %s as given', (text) => {
    expect(new Bic(text).value).toBe(text);
  });

  it('accepts digits in the location and the branch', () => {
    expect(Bic.parse('ABCDUS33').ok).toBe(true);
    expect(Bic.parse('ABCDUS0012A').ok).toBe(true);
  });

  it.each(CountryCode.codes)('accepts the country %s', (country) => {
    expect(Bic.parse(`ABCD${country}2L`).ok).toBe(true);
  });

  it.each([
    ['seven characters', 'DEUTDEF'],
    ['nine characters', 'DEUTDEFF5'],
    ['ten characters', 'DEUTDEFF50'],
    ['twelve characters', 'DEUTDEFF5000'],
    ['lower case, which validator.js isBIC accepts', 'deutdeff'],
    ['a lowercase branch', 'DEUTDEFF50a'],
    ['a digit in the institution', 'DEU1DEFF'],
    ['a digit in the country', 'DEUTD1FF'],
    ['a country no one has, ZZ', 'DEUTZZFF'],
    ['the reserved code UK', 'NWBKUK2L'],
    ['the reserved code EU', 'ABCDEU2L'],
    ['a space before the branch', 'DEUTDEFF 500'],
    ['a hyphen', 'DEUT-DE-FF'],
    ['a space around it', ' DEUTDEFF'],
    ['full-width letters', 'ＤＥＵＴＤＥＦＦ'],
    ['empty', ''],
  ])('rejects %s', (_, text) => {
    expect(() => new Bic(text)).toThrow(NominalError);
  });

  it.each([42, null, undefined, {}, [], new Object('DEUTDEFF')])('rejects %o', (input) => {
    expect(Bic.parse(input).ok).toBe(false);
  });

  it('says why it refuses, with the value, which is not personal data', () => {
    expect(Bic.parse('DEUTZZFF')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be a BIC (was "DEUTZZFF")' }],
    });
  });

  it('refuses long crafted input quickly', () => {
    const started = performance.now();

    expect(Bic.parse('A'.repeat(100_000)).ok).toBe(false);
    expect(Bic.parse(`DEUTDEFF${'0'.repeat(100_000)}`).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it.each([
    ['DEUTDEFF500', 'DEUT', 'DE', 'FF', '500', false],
    ['DEUTDEFFXXX', 'DEUT', 'DE', 'FF', 'XXX', true],
    ['DEUTDEFF', 'DEUT', 'DE', 'FF', 'XXX', true],
  ])('reads the parts of %s', (text, institution, country, location, branch, primary) => {
    const bic = new Bic(text);

    expect([bic.institution, bic.countryCode, bic.location, bic.branch]).toStrictEqual([
      institution,
      country,
      location,
      branch,
    ]);
    expect(bic.isPrimaryOffice).toBe(primary);
  });

  it.each([
    ['DEUTDEFF', 'DEUTDEFFXXX'],
    ['DEUTDEFFXXX', 'DEUTDEFFXXX'],
    ['DEUTDEFF500', 'DEUTDEFF500'],
  ])('gives the 11 characters of %s as its canonical form', (text, eleven) => {
    expect(new Bic(text).canonical()).toStrictEqual(new Bic(eleven));
  });

  it('finds a BIC of 8 equal to its primary office, also from another copy', async () => {
    const copy = await anotherCopy();

    expect(new Bic('DEUTDEFF').equals(new Bic('DEUTDEFFXXX'))).toBe(true);
    expect(new Bic('DEUTDEFFXXX').equals(new copy.Bic('DEUTDEFF'))).toBe(true);
    expect(new Bic('DEUTDEFF').equals(new Bic('DEUTDEFF500'))).toBe(false);
    expect(new Bic('DEUTDEFF').equals('DEUTDEFF')).toBe(false);
    expect(new Bic('DEUTDEFF').equals(new AnyString('DEUTDEFF'))).toBe(true);
    expect(new Bic('DEUTDEFF').equals(new AnyString('DEUTDEFFXXX'))).toBe(false);
  });
});

describe('Bic as JSON Schema', () => {
  it.each(['DEUTDEFF', 'DEUTDEFF500', 'ABCDUS0012A'])('accepts %s like the type does', (text) => {
    expect(Bic.parse(text).ok).toBe(true);
    expect(
      satisfiesSchema(Bic['~standard'].jsonSchema.input({ target: 'draft-2020-12' }), text),
    ).toBe(true);
  });

  it.each(['deutdeff', 'DEU1DEFF', 'DEUTDEFF5', 'DEUTDEFF5000'])(
    'rejects %s like the type does',
    (text) => {
      expect(Bic.parse(text).ok).toBe(false);
      expect(
        satisfiesSchema(Bic['~standard'].jsonSchema.input({ target: 'draft-2020-12' }), text),
      ).toBe(false);
    },
  );

  const texts = randomTexts(
    ['DEUT', 'DE', 'ZZ', 'UK', 'FF', '50', '0', 'X', 'x', 'A', ' '],
    20_000,
    6,
  );

  it('describes its shape', () => {
    expect(Bic['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      type: 'string',
      pattern: Bic.pattern.source,
      minLength: 8,
      maxLength: 11,
    });
  });

  // A pattern of every country would be long; the schema accepts a country no one has.
  it('agrees with the type on generated text, apart from the country', () => {
    const disagreements = disagreementsOf(Bic, texts);

    expect(disagreements.filter((text) => Bic.parse(text).ok)).toStrictEqual([]);
    expect(
      disagreements.filter((text) => CountryCode.codes.includes(text.slice(4, 6))),
    ).toStrictEqual([]);
  });

  it('finds both answers among the generated text', () => {
    expect(texts.filter((text) => Bic.parse(text).ok).length).toBeGreaterThan(20);
    expect(disagreementsOf(Bic, texts).length).toBeGreaterThan(20);
  });
});
