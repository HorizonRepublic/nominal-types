import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { AnyString, DecimalString, n, NominalError } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, thrownBy, valueOf } from '../../support/results.ts';

class Price extends DecimalString.subtype('test.Price', /^[^-]/u) {}

const schema = DecimalString['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
const longest = `${'9'.repeat(50)}.${'9'.repeat(49)}`;

const accepted = [
  '0',
  '-0',
  '0.0',
  '-0.00',
  '7',
  '12.34',
  '12.50',
  '-12.5',
  '0.001',
  '100',
  '9'.repeat(100),
  longest,
];
const rejected = [
  '',
  '-',
  '+1',
  '.5',
  '5.',
  '-.5',
  '01',
  '-01',
  '00.5',
  '1e3',
  '1E3',
  '1.5e-3',
  '0x1f',
  'NaN',
  'Infinity',
  '1,5',
  '1_000',
  ' 1',
  '1 ',
  '1\n',
  '--1',
  '1.2.3',
  '١٢',
  '１２',
  '9'.repeat(101),
  `${longest}9`,
];

describe('DecimalString', () => {
  it.each(accepted)('accepts %s as given', (text) => {
    expect(new DecimalString(text).value).toBe(text);
  });

  it.each(rejected)('rejects %j', (text) => {
    expect(() => new DecimalString(text)).toThrow(NominalError);
  });

  it('takes 100 characters and refuses 101', () => {
    expect(longest).toHaveLength(100);
    expect(DecimalString.parse(longest).ok).toBe(true);
    expect(DecimalString.parse(`-${longest}`).ok).toBe(false);
    expect(DecimalString.parse('9'.repeat(101)).ok).toBe(false);
  });

  it('says what it wants', () => {
    expect(issuesOf(DecimalString.parse('1e3'))).toStrictEqual([
      { message: 'must be a decimal number as text (was "1e3")' },
    ]);
  });

  it.each([12.34, 0, 12n, null, undefined, true, {}, [], new Object('1')])(
    'rejects the non-string %s rather than converting it',
    (input) => {
      expect(issuesOf(DecimalString.parse(input))).toHaveLength(1);
    },
  );

  it.each([...accepted, ...rejected, 12.34])('agrees with its JSON Schema on %j', (value) => {
    expect(satisfiesSchema(schema, value)).toBe(DecimalString.parse(value).ok);
  });

  it('refuses .5 and 400 nines, which validator.js isDecimal accepts (#2430, #1309)', () => {
    expect(DecimalString.parse('.5').ok).toBe(false);
    expect(DecimalString.parse('9'.repeat(400)).ok).toBe(false);
  });

  it.each([
    ['0', 0],
    ['-0', 0],
    ['-0.000', 0],
    ['0.001', 1],
    ['-0.001', -1],
    ['12', 1],
    ['-12', -1],
  ] as const)('gives %s the sign %d', (text, sign) => {
    expect(new DecimalString(text).sign).toBe(sign);
  });

  it.each([
    ['0', 1, 0],
    ['-0.5', 1, 1],
    ['12.50', 2, 2],
    ['1000', 4, 0],
  ] as const)('counts the digits of %s as written', (text, integer, fraction) => {
    expect(new DecimalString(text).integerDigits).toBe(integer);
    expect(new DecimalString(text).fractionDigits).toBe(fraction);
  });

  it.each([
    ['12.5', 2, 1250n],
    ['12.50', 2, 1250n],
    ['12.500', 2, 1250n],
    ['-0.01', 2, -1n],
    ['-0', 2, 0n],
    ['7', 0, 7n],
    ['7', 3, 7000n],
    ['0.5', 1, 5n],
    [longest, 49, BigInt('9'.repeat(99))],
  ] as const)('turns %s with scale %d into %d minor units', (text, scale, minor) => {
    expect(new DecimalString(text).toMinorUnits(scale)).toBe(minor);
  });

  it('refuses to lose a digit in toMinorUnits', () => {
    expect(thrownBy(() => new DecimalString('12.345').toMinorUnits(2))).toStrictEqual(
      new RangeError('toMinorUnits(): 12.345 has more than 2 digits after the point'),
    );
    expect(() => new DecimalString('0.5').toMinorUnits(0)).toThrow(RangeError);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses the scale %d', (scale) => {
    expect(() => new DecimalString('1').toMinorUnits(scale)).toThrow(RangeError);
    expect(() => DecimalString.fromMinorUnits(1n, scale)).toThrow(RangeError);
  });

  it.each([
    [1250n, 2, '12.50'],
    [-1n, 2, '-0.01'],
    [0n, 2, '0.00'],
    [0n, 0, '0'],
    [5n, 3, '0.005'],
    [-123_456n, 0, '-123456'],
  ] as const)('writes %d minor units with scale %d as %s', (minor, scale, text) => {
    expect(DecimalString.fromMinorUnits(minor, scale).value).toBe(text);
  });

  it('builds the class fromMinorUnits is called on, and its rules apply', () => {
    expect(Price.fromMinorUnits(1250n, 2)).toBeInstanceOf(Price);
    expect(thrownBy(() => Price.fromMinorUnits(-1n, 2))).toBeInstanceOf(NominalError);
    expect(thrownBy(() => DecimalString.fromMinorUnits(10n ** 100n, 0))).toBeInstanceOf(
      NominalError,
    );
  });

  it.each([
    ['1', '2', -1],
    ['2', '1', 1],
    ['1.5', '1.50', 0],
    ['-0', '0', 0],
    ['-1', '-2', 1],
    ['-1.01', '-1.1', 1],
    ['0.1', '0.09999999999999999999', 1],
    ['10', '9.99', 1],
    ['12345678901234567890.1', '12345678901234567890.01', 1],
  ] as const)('compares %s with %s exactly', (left, right, order) => {
    expect(new DecimalString(left).compare(new DecimalString(right))).toBe(order);
  });

  it('sorts with compare', () => {
    const sorted = ['10', '-1', '0.5', '2', '-0.25']
      .map((text) => new DecimalString(text))
      .toSorted((left, right) => left.compare(right))
      .map(({ value }) => value);

    expect(sorted).toStrictEqual(['-1', '-0.25', '0.5', '2', '10']);
  });

  it.each([
    ['12.50', '12.5'],
    ['12.00', '12'],
    ['100', '100'],
    ['100.0', '100'],
    ['-0', '0'],
    ['-0.00', '0'],
    ['0.0010', '0.001'],
    ['-1.10', '-1.1'],
  ])('writes %s as %s in canonical form', (text, canonical) => {
    expect(new DecimalString(text).canonical().value).toBe(canonical);
  });

  it('keeps a subtype in canonical()', () => {
    expect(new Price('1.50').canonical()).toBeInstanceOf(Price);
  });

  it('compares numbers in equals, both ways and in unique arrays', () => {
    expect(new DecimalString('1.5').equals(new DecimalString('1.50'))).toBe(true);
    expect(new DecimalString('1.50').equals(new DecimalString('1.5'))).toBe(true);
    expect(new DecimalString('-0').equals(new DecimalString('0'))).toBe(true);
    expect(new DecimalString('1.5').equals(new DecimalString('1.51'))).toBe(false);
    expect(new DecimalString('1.5').equals('1.5')).toBe(false);
    expect(n.of(DecimalString).array({ unique: true }).parse(['1.5', '1.50']).ok).toBe(false);
    expect(n.of(DecimalString).array({ unique: true }).parse(['1.5', '15']).ok).toBe(true);
  });

  it('stays apart from a sibling type with the same text', () => {
    const Other = AnyString.subtype('test.Other');

    expect(new DecimalString('1').equals(new Other('1'))).toBe(false);
  });

  it('writes JSON as a string, so no digit is lost', () => {
    expect(JSON.stringify({ total: new DecimalString('0.10000000000000000001') })).toBe(
      '{"total":"0.10000000000000000001"}',
    );
  });

  it('stays fast on a long crafted input', () => {
    const started = performance.now();

    expect(DecimalString.parse(`1.${'0'.repeat(100_000)}x`).ok).toBe(false);
    expect(DecimalString.parse('1'.repeat(100_000)).ok).toBe(false);
    expect(DecimalString.parse(`${'-'.repeat(100_000)}1`).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('narrows a value built by another copy of the package and compares it', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const amount = new copy.DecimalString('1.50');

    expect(valueOf(DecimalString.parse(amount))).toStrictEqual(new DecimalString('1.50'));
    expect(new DecimalString('1.5').equals(amount)).toBe(true);
    expect(valueOf(DecimalString.parse(new copy.AnyString('2')))).toBeInstanceOf(DecimalString);
  });
});
