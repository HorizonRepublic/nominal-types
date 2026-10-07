import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { CurrencyCode, NominalError } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, thrownBy, valueOf } from '../../support/results.ts';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const triples = Array.from(letters).flatMap((first) =>
  Array.from(letters).flatMap((second) => Array.from(letters, (third) => first + second + third)),
);

describe('CurrencyCode', () => {
  it('knows the 178 codes of List One, sorted and frozen', () => {
    expect(CurrencyCode.codes).toHaveLength(178);
    expect(CurrencyCode.codes).toStrictEqual(CurrencyCode.codes.toSorted());
    expect(Object.isFrozen(CurrencyCode.codes)).toBe(true);
  });

  it.each(CurrencyCode.codes.map((code) => [code]))('accepts %s', (code) => {
    expect(new CurrencyCode(code).value).toBe(code);
  });

  it.each([
    ['HRK', 'withdrawn in 2023, when Croatia took the euro'],
    ['BGN', 'withdrawn in 2026, when Bulgaria took the euro'],
    ['ANG', 'replaced by XCG in 2025'],
    ['ZWL', 'replaced by ZWG in 2024'],
    ['CUC', 'withdrawn in 2022'],
    ['SLL', 'replaced by SLE'],
    ['VEF', 'replaced by VES'],
    ['EUX', 'never assigned'],
  ])('refuses %s, %s', (code) => {
    expect(CurrencyCode.parse(code).ok).toBe(false);
  });

  it.each(['usd', 'Usd', 'usD', 'US', 'USDT', '', ' USD', 'USD ', 'U$D', 'ＵＳＤ', '840'])(
    'refuses %j',
    (text) => {
      expect(CurrencyCode.parse(text).ok).toBe(false);
    },
  );

  it.each([840, null, undefined, {}, ['USD'], new Object('USD'), Symbol('USD'), false])(
    'refuses the non-string %s',
    (input) => {
      expect(CurrencyCode.parse(input).ok).toBe(false);
    },
  );

  it('refuses the names of object members', () => {
    expect(CurrencyCode.parse('constructor').ok).toBe(false);
    expect(CurrencyCode.parse('__proto__').ok).toBe(false);
  });

  it('accepts ZWG, added in 2024, which validator.js isISO4217 refuses', () => {
    expect(new CurrencyCode('ZWG').minorUnits).toBe(2);
  });

  it('accepts both Venezuelan codes, VED and VES', () => {
    expect(CurrencyCode.parse('VED').ok).toBe(true);
    expect(CurrencyCode.parse('VES').ok).toBe(true);
  });

  it('accepts XXX for no currency and XTS for testing, without minor units', () => {
    expect(new CurrencyCode('XXX').minorUnits).toBeUndefined();
    expect(new CurrencyCode('XTS').minorUnits).toBeUndefined();
  });

  it('reports the rejection in words', () => {
    expect(thrownBy(() => new CurrencyCode('usd'))).toStrictEqual(
      new NominalError('nominal.CurrencyCode', [
        { message: 'must be an ISO 4217 currency code (was "usd")' },
      ]),
    );
    expect(issuesOf(CurrencyCode.parse(840))).toStrictEqual([
      { message: 'must be an ISO 4217 currency code (was 840)' },
    ]);
  });

  it.each([
    ['JPY', 0],
    ['KRW', 0],
    ['UYI', 0],
    ['EUR', 2],
    ['USD', 2],
    ['BHD', 3],
    ['TND', 3],
    ['CLF', 4],
    ['UYW', 4],
    ['XAU', undefined],
    ['XDR', undefined],
  ])('gives %s %s minor units', (code, units) => {
    expect(new CurrencyCode(code).minorUnits).toBe(units);
  });

  it('tells funds from currencies', () => {
    const funds = CurrencyCode.codes.filter((code) => new CurrencyCode(code).isFund);

    expect(funds).toStrictEqual([
      'BOV',
      'CHE',
      'CHW',
      'CLF',
      'COU',
      'MXV',
      'USN',
      'UYI',
      'UYW',
      'XAD',
    ]);
  });

  it('describes itself with the list of codes', () => {
    expect(CurrencyCode['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toStrictEqual({
      title: 'nominal.CurrencyCode',
      type: 'string',
      enum: CurrencyCode.codes,
      minLength: 3,
      maxLength: 3,
      example: 'EUR',
      description: 'an ISO 4217 currency code',
    });
  });

  it('agrees with its JSON Schema on every three letters and more', () => {
    const schema = CurrencyCode['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
    const values = [...triples, 'eur', 'Eur', '', 'EU', 'EURO', 978, null];
    const accepted = values.filter((value) => CurrencyCode.parse(value).ok);

    expect(accepted).toHaveLength(178);
    expect(values.filter((value) => satisfiesSchema(schema, value))).toStrictEqual(accepted);
  });

  it('takes a code built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const foreign = new copy.CurrencyCode('JPY');

    expect(valueOf(CurrencyCode.parse(foreign)).minorUnits).toBe(0);
    expect(foreign.equals(new CurrencyCode('JPY'))).toBe(true);
  });
});
