import { describe, expect, it, vi } from 'vitest';

import { equalityKeySlot, noKey } from '../../../src/core/same-value.ts';
import type { EqualityKey } from '../../../src/core/same-value.ts';
import type * as library from '../../../src/index.ts';
import { CurrencyCode, DecimalString, Money, n, NominalError } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, thrownBy, valueOf } from '../../support/results.ts';

const money = (amount: string, currency = 'EUR'): Money => new Money({ amount, currency });

const schema = Money['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

describe('Money', () => {
  it('holds an amount and a currency as instances', () => {
    const price = money('12.34');

    expect(price.amount).toStrictEqual(new DecimalString('12.34'));
    expect(price.currency).toStrictEqual(new CurrencyCode('EUR'));
  });

  it.each([
    ['12.34', 'EUR'],
    ['12.3', 'EUR'],
    ['12', 'EUR'],
    ['-0.01', 'EUR'],
    ['1000', 'JPY'],
    ['1.234', 'KWD'],
    ['1.2345', 'CLF'],
    ['1.23456789', 'XAU'],
    ['0', 'XXX'],
  ])('accepts %s %s', (amount, currency) => {
    expect(Money.parse({ amount, currency }).ok).toBe(true);
  });

  it.each([
    ['12.345', 'EUR', 'must have at most 2 digits after the point in EUR'],
    ['12.340', 'EUR', 'must have at most 2 digits after the point in EUR'],
    ['1.5', 'JPY', 'must have no digits after the point in JPY'],
    ['1.0', 'JPY', 'must have no digits after the point in JPY'],
    ['1.2345', 'KWD', 'must have at most 3 digits after the point in KWD'],
  ])('refuses %s %s, more digits than the currency has', (amount, currency, message) => {
    expect(issuesOf(Money.parse({ amount, currency }))).toStrictEqual([
      { message, path: ['amount'] },
    ]);
  });

  it.each([
    [{ amount: 12.34, currency: 'EUR' }, 'must be a string (was 12.34)', ['amount']],
    [
      { amount: '1e3', currency: 'EUR' },
      'must be a decimal number as text (was "1e3")',
      ['amount'],
    ],
    [
      { amount: '1', currency: 'eur' },
      'must be an ISO 4217 currency code (was "eur")',
      ['currency'],
    ],
    [
      { amount: '1', currency: 'HRK' },
      'must be an ISO 4217 currency code (was "HRK")',
      ['currency'],
    ],
    [{ amount: '1' }, 'is required', ['currency']],
  ])('refuses %o', (input, message, path) => {
    expect(issuesOf(Money.parse(input))).toContainEqual({ message, path });
  });

  it.each([null, undefined, '12.34 EUR', 12.34, []])('refuses %o', (input) => {
    expect(Money.parse(input).ok).toBe(false);
  });

  it.each([
    { amount: '12.34', currency: 'EUR' },
    { amount: 12.34, currency: 'EUR' },
    { amount: '1', currency: 'eur' },
    { amount: '1e3', currency: 'EUR' },
    { amount: '1' },
  ])('agrees with its JSON Schema on %o where the schema can tell', (input) => {
    expect(satisfiesSchema(schema, input)).toBe(Money.parse(input).ok);
  });

  it('describes the digits per currency nowhere in its JSON Schema, so the schema is wider', () => {
    expect(satisfiesSchema(schema, { amount: '1.5', currency: 'JPY' })).toBe(true);
    expect(Money.parse({ amount: '1.5', currency: 'JPY' }).ok).toBe(false);
  });

  it('travels as JSON with the amount as text', () => {
    const price = money('12.30');

    expect(JSON.stringify(price)).toBe('{"amount":"12.30","currency":"EUR"}');
    expect(Money.stringify(price)).toBe('{"amount":"12.30","currency":"EUR"}');
    expect(n.plain(price)).toStrictEqual({ amount: '12.30', currency: 'EUR' });
    expect(valueOf(Money.parse(JSON.parse(JSON.stringify(price)))).equals(price)).toBe(true);
    expect(Money.accepts({ amount: '12.30', currency: 'EUR' })).toBe(true);
  });

  it.each([
    ['12.34', 'EUR', 1234n],
    ['12.3', 'EUR', 1230n],
    ['-0.01', 'EUR', -1n],
    ['1000', 'JPY', 1000n],
    ['1.234', 'KWD', 1234n],
  ])('counts %s %s as %d minor units', (amount, currency, minor) => {
    expect(money(amount, currency).minor).toBe(minor);
  });

  it('has no minor count for a currency without minor units', () => {
    expect(thrownBy(() => money('1.5', 'XAU').minor)).toStrictEqual(
      new TypeError('minor: XAU has no minor units'),
    );
  });

  it.each([
    [1234n, 'EUR', '12.34'],
    [-5n, 'EUR', '-0.05'],
    [0n, 'JPY', '0'],
    [1n, 'KWD', '0.001'],
  ])('builds %d minor units of %s as %s', (minor, currency, amount) => {
    expect(Money.fromMinor(minor, currency).amount.value).toBe(amount);
    expect(Money.fromMinor(minor, new CurrencyCode(currency)).minor).toBe(minor);
  });

  it('refuses fromMinor for a currency without minor units or an unknown code', () => {
    expect(() => Money.fromMinor(1n, 'XAU')).toThrow(TypeError);
    expect(() => Money.fromMinor(1n, 'HRK')).toThrow(NominalError);
  });

  it('adds and subtracts exactly, written with the currency digits', () => {
    expect(money('0.1').add(money('0.2')).amount.value).toBe('0.30');
    expect(money('12.5').add(money('1')).amount.value).toBe('13.50');
    expect(money('1').subtract(money('1.01')).amount.value).toBe('-0.01');
    expect(money('1000', 'JPY').add(money('1', 'JPY')).amount.value).toBe('1001');
    expect(money('99999999999999999999.99').add(money('0.01')).amount.value).toBe(
      '100000000000000000000.00',
    );
  });

  it('keeps every digit for a currency without minor units', () => {
    expect(money('1.5', 'XAU').add(money('0.25', 'XAU')).amount.value).toBe('1.75');
    expect(money('1', 'XAU').subtract(money('1', 'XAU')).amount.value).toBe('0');
  });

  it.each(['add', 'subtract', 'compare'] as const)('refuses to %s two currencies', (method) => {
    expect(thrownBy(() => money('1')[method](money('1', 'USD')))).toStrictEqual(
      new TypeError(`${method}(): USD cannot be mixed with EUR`),
    );
  });

  it('multiplies by a whole number', () => {
    expect(money('12.34').multiply(3).amount.value).toBe('37.02');
    expect(money('12.34').multiply(-2n).amount.value).toBe('-24.68');
    expect(money('1.25', 'XAU').multiply(4).amount.value).toBe('5.00');
    expect(() => money('1').multiply(1.5)).toThrow(RangeError);
    expect(() => money('1').multiply(Number.NaN)).toThrow(RangeError);
  });

  it('tells zero and negative amounts', () => {
    expect(money('0').isZero).toBe(true);
    expect(money('-0').isZero).toBe(true);
    expect(money('-0').isNegative).toBe(false);
    expect(money('-0.01').isNegative).toBe(true);
    expect(money('0.01').isZero).toBe(false);
  });

  it('compares amounts of one currency', () => {
    expect(money('1.5').compare(money('1.50'))).toBe(0);
    expect(money('1.49').compare(money('1.5'))).toBe(-1);
    expect(money('-1').compare(money('-2'))).toBe(1);
  });

  it('writes the currency digits in canonical form', () => {
    expect(money('12.5').canonical().amount.value).toBe('12.50');
    expect(money('-0').canonical().amount.value).toBe('0.00');
    expect(money('7', 'JPY').canonical().amount.value).toBe('7');
    expect(money('1.500', 'XAU').canonical().amount.value).toBe('1.5');
  });

  it('ignores trailing zeros in equals, and keeps currencies apart', () => {
    expect(money('12.5').equals(money('12.50'))).toBe(true);
    expect(money('12.50').equals(money('12.5'))).toBe(true);
    expect(money('12.5').equals(money('12.5', 'USD'))).toBe(false);
    expect(money('12.5').equals(money('12.51'))).toBe(false);
    expect(money('12.5').equals({ amount: '12.5', currency: 'EUR' })).toBe(false);
  });

  it('finds repeats in a unique array by the same rule', () => {
    const unique = n.of(Money).array({ unique: true });

    expect(
      unique.parse([
        { amount: '1.5', currency: 'EUR' },
        { amount: '1.50', currency: 'EUR' },
      ]).ok,
    ).toBe(false);
    expect(
      unique.parse([
        { amount: '1.5', currency: 'EUR' },
        { amount: '1.5', currency: 'USD' },
      ]).ok,
    ).toBe(true);
  });

  it('keys only its own instances for unique arrays', () => {
    // The key sits under a symbol the package reads at runtime, untyped.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const rule = Reflect.get(Money.prototype, equalityKeySlot) as EqualityKey;

    expect(rule.key({ value: 1 })).toBe(noKey);
  });

  it('formats for display with the digits of the currency', () => {
    expect(money('12.3').format('en-US')).toBe('€12.30');
    expect(money('1234.5').format('de-DE')).toBe('1.234,50\u00A0€');
    expect(money('1000', 'JPY').format('en-US')).toBe('¥1,000');
    expect(money('1.23456', 'XAU').format('en-US')).toBe('XAU\u00A01.23456');
    expect(money('12345678901234567890.12').format('en-US')).toBe('€12,345,678,901,234,567,890.12');
  });

  it('changes a field with copyWith and checks the result', () => {
    expect(money('1').copyWith({ currency: 'USD' }).currency.value).toBe('USD');
    expect(thrownBy(() => money('1.5').copyWith({ currency: 'JPY' }))).toBeInstanceOf(NominalError);
  });

  it('keeps a subtype through its arithmetic', () => {
    class Price extends Money.subtype(
      'test.Price',
      n.constraint({ amount: DecimalString }, ({ amount }) => amount.sign >= 0, {
        path: 'amount',
        message: 'must not be negative',
      }),
    ) {}

    expect(new Price({ amount: '1', currency: 'EUR' }).add(money('1'))).toBeInstanceOf(Price);
    expect(Price.fromMinor(100n, 'EUR')).toBeInstanceOf(Price);
    expect(
      thrownBy(() => new Price({ amount: '1', currency: 'EUR' }).subtract(money('2'))),
    ).toBeInstanceOf(NominalError);
  });

  it('narrows a value built by another copy of the package and compares it', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const other = new copy.Money({ amount: '1.50', currency: 'EUR' });

    expect(valueOf(Money.parse(other)).equals(money('1.5'))).toBe(true);
    expect(money('1.5').equals(other)).toBe(true);
  });
});
