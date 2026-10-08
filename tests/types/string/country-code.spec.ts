import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { CountryCode, NominalError } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, thrownBy, valueOf } from '../../support/results.ts';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const pairs = Array.from(letters).flatMap((first) =>
  Array.from(letters, (second) => first + second),
);

describe('CountryCode', () => {
  it('knows the 249 officially assigned codes and XK, sorted and frozen', () => {
    expect(CountryCode.codes).toHaveLength(250);
    expect(CountryCode.codes).toStrictEqual(CountryCode.codes.toSorted());
    expect(new Set(CountryCode.codes).size).toBe(250);
    expect(Object.isFrozen(CountryCode.codes)).toBe(true);
  });

  it.each(CountryCode.codes.map((code) => [code]))('accepts %s', (code) => {
    expect(new CountryCode(code).value).toBe(code);
  });

  it.each(['BQ', 'CW', 'SX', 'SS', 'AX', 'GB', 'UA', 'US', 'XK'])('accepts %s', (code) => {
    expect(CountryCode.parse(code).ok).toBe(true);
  });

  it.each([
    ['UK', 'reserved for the United Kingdom, which is GB'],
    ['EU', 'reserved for the European Union'],
    ['AN', 'deleted in 2010'],
    ['CS', 'deleted in 2006'],
    ['SU', 'transitionally reserved'],
    ['ZZ', 'user-assigned'],
    ['AA', 'user-assigned'],
  ])('refuses %s, %s', (code) => {
    expect(CountryCode.parse(code).ok).toBe(false);
  });

  it.each(['us', 'Us', 'uS', 'USA', 'U', '', ' US', 'US ', 'U S', 'U-S', 'ＵＳ', '840'])(
    'refuses %j',
    (text) => {
      expect(CountryCode.parse(text).ok).toBe(false);
    },
  );

  it.each([840, null, undefined, {}, ['US'], new Object('US'), Symbol('US'), true])(
    'refuses the non-string %s',
    (input) => {
      expect(CountryCode.parse(input).ok).toBe(false);
    },
  );

  it('refuses the names of object members', () => {
    expect(CountryCode.parse('constructor').ok).toBe(false);
    expect(CountryCode.parse('__proto__').ok).toBe(false);
  });

  it('VJS #2045: refuses gb and usa, which validator.js isISO31661Alpha2 accepts', () => {
    expect(CountryCode.parse('gb').ok).toBe(false);
    expect(CountryCode.parse('usa').ok).toBe(false);
    expect(CountryCode.parse('GB').ok).toBe(true);
  });

  it('reports the rejection in words', () => {
    expect(thrownBy(() => new CountryCode('us'))).toStrictEqual(
      new NominalError('nominal.CountryCode', [
        { message: 'must be an ISO 3166-1 alpha-2 country code (was "us")' },
      ]),
    );
    expect(issuesOf(CountryCode.parse(840))).toStrictEqual([
      { message: 'must be an ISO 3166-1 alpha-2 country code (was 840)' },
    ]);
  });

  it.each([
    ['UA', '🇺🇦'],
    ['US', '🇺🇸'],
    ['AX', '🇦🇽'],
  ])('writes the flag of %s', (code, flag) => {
    expect(new CountryCode(code).flag).toBe(flag);
  });

  it('describes itself with the list of codes', () => {
    expect(CountryCode['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toStrictEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'nominal.CountryCode',
      type: 'string',
      enum: CountryCode.codes,
      minLength: 2,
      maxLength: 2,
      examples: ['US'],
      description: 'an ISO 3166-1 alpha-2 country code',
    });
  });

  it('agrees with its JSON Schema on every pair of letters and more', () => {
    const schema = CountryCode['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
    const values = [...pairs, ...pairs.map((pair) => pair.toLowerCase()), '', 'USA', 'U', 42, null];
    const accepted = values.filter((value) => CountryCode.parse(value).ok);

    expect(accepted).toHaveLength(250);
    expect(values.filter((value) => satisfiesSchema(schema, value))).toStrictEqual(accepted);
  });

  it('takes a code built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const foreign = new copy.CountryCode('DE');

    expect(valueOf(CountryCode.parse(foreign)).value).toBe('DE');
    expect(foreign.equals(new CountryCode('DE'))).toBe(true);
    expect(foreign.equals(new CountryCode('FR'))).toBe(false);
  });
});
