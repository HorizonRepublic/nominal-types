import { describe, expect, it } from 'vitest';

import {
  AnyNumber,
  FiniteNumber,
  Float32,
  Int16,
  Int32,
  Int8,
  Integer,
  Latitude,
  Longitude,
  NegativeInteger,
  NegativeNumber,
  NonNegativeInteger,
  NonNegativeNumber,
  NonPositiveInteger,
  NonPositiveNumber,
  Port,
  PositiveInteger,
  PositiveNumber,
  Uint16,
  Uint32,
  Uint8,
} from '../../../src/index.ts';
import type { AnyNominalType } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, valueOf } from '../../support/results.ts';

const max = Number.MAX_SAFE_INTEGER;
const min = Number.MIN_SAFE_INTEGER;

const finite = [
  0,
  -0,
  1,
  -1,
  0.5,
  -0.5,
  0.1,
  1.5,
  Number.EPSILON,
  Number.MIN_VALUE,
  Number.MAX_VALUE,
  -Number.MAX_VALUE,
  max,
  max + 1,
  max + 2,
  min,
  min - 1,
  127,
  128,
  -128,
  -129,
  255,
  256,
  32_767,
  32_768,
  -32_768,
  -32_769,
  65_535,
  65_536,
  2_147_483_647,
  2_147_483_648,
  -2_147_483_648,
  -2_147_483_649,
  4_294_967_295,
  4_294_967_296,
  (2 - 2 ** -23) * 2 ** 127,
  2 ** 128,
  16_777_216,
  16_777_217,
  90,
  -90,
  90.000_000_1,
  -90.000_000_1,
  180,
  -180,
  180.000_000_1,
  -180.000_000_1,
  51.5,
];
const special = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
const foreign: unknown[] = ['1', '', 1n, null, undefined, true, new Object(1), [1], {}];

const isFloat32 = (value: number): boolean => Math.fround(value) === value;
const isSafe = Number.isSafeInteger;
const inRange = (lowest: number, highest: number) => (value: number) =>
  isSafe(value) && value >= lowest && value <= highest;

const expectations: ReadonlyArray<
  readonly [AnyNominalType, (value: number) => boolean, ((value: number) => boolean)?]
> = [
  [AnyNumber, () => true],
  [FiniteNumber, Number.isFinite],
  [PositiveNumber, (value) => Number.isFinite(value) && value > 0],
  [NegativeNumber, (value) => Number.isFinite(value) && value < 0],
  [NonNegativeNumber, (value) => Number.isFinite(value) && value >= 0],
  [NonPositiveNumber, (value) => Number.isFinite(value) && value <= 0],
  // JSON Schema has no way to say a number fits a 32-bit float exactly
  [Float32, (value) => Number.isFinite(value) && isFloat32(value), Number.isFinite],
  [Integer, isSafe],
  [PositiveInteger, (value) => isSafe(value) && value > 0],
  [NegativeInteger, (value) => isSafe(value) && value < 0],
  [NonNegativeInteger, (value) => isSafe(value) && value >= 0],
  [NonPositiveInteger, (value) => isSafe(value) && value <= 0],
  [Int8, inRange(-128, 127)],
  [Int16, inRange(-32_768, 32_767)],
  [Int32, inRange(-2_147_483_648, 2_147_483_647)],
  [Uint8, inRange(0, 255)],
  [Uint16, inRange(0, 65_535)],
  [Uint32, inRange(0, 4_294_967_295)],
  [Port, inRange(1, 65_535)],
  [Latitude, (value) => value >= -90 && value <= 90],
  [Longitude, (value) => value >= -180 && value <= 180],
];

describe.each(
  expectations.map(
    ([type, accepts, schemaAccepts = accepts]) =>
      [type.typeName, type, accepts, schemaAccepts] as const,
  ),
)('%s', (_, type, accepts, schemaAccepts) => {
  it.each([...finite, ...special])('answers %s as expected', (value) => {
    expect(type.parse(value).ok).toBe(accepts(value));
  });

  it.each(foreign)('rejects %s', (value) => {
    expect(type.parse(value).ok).toBe(false);
  });

  it.each(finite)('agrees with its JSON Schema on %s', (value) => {
    const schema = type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

    expect(satisfiesSchema(schema, value)).toBe(schemaAccepts(value));
  });

  it('keeps the value as given', () => {
    const value = [1, 0, -1, 0.5].find((candidate) => accepts(candidate));

    expect(valueOf(type.parse(value)).value).toBe(value);
  });
});

describe('the number hierarchy', () => {
  const parents: ReadonlyArray<readonly [AnyNominalType, AnyNominalType, number]> = [
    [AnyNumber, FiniteNumber, 1],
    [FiniteNumber, PositiveNumber, 1],
    [FiniteNumber, NegativeNumber, -1],
    [FiniteNumber, NonNegativeNumber, 1],
    [FiniteNumber, NonPositiveNumber, -1],
    [FiniteNumber, Float32, 1],
    [FiniteNumber, Integer, 1],
    [Integer, PositiveInteger, 1],
    [Integer, NegativeInteger, -1],
    [Integer, NonNegativeInteger, 1],
    [Integer, NonPositiveInteger, -1],
    [Integer, Int8, 1],
    [Integer, Int16, 1],
    [Integer, Int32, 1],
    [Integer, Uint8, 1],
    [Integer, Uint16, 1],
    [Integer, Uint32, 1],
    [Uint16, Port, 1],
    [FiniteNumber, Latitude, -0.5],
    [FiniteNumber, Longitude, 0.5],
  ];

  it.each(
    parents.map(
      ([parent, child, value]) => [child.typeName, parent.typeName, parent, child, value] as const,
    ),
  )('%s passes where %s is expected, not the other way round', (_, __, parent, child, value) => {
    const instance = valueOf(child.parse(value));

    expect(instance).toBeInstanceOf(parent);
    expect(instance).toBeInstanceOf(AnyNumber);
    expect(parent.parse(instance)).toStrictEqual({ ok: true, value: instance });
    expect(valueOf(parent.parse(value))).not.toBeInstanceOf(child);
  });

  it('keeps types with the same value apart', () => {
    expect(new PositiveInteger(1)).not.toBeInstanceOf(PositiveNumber);
    expect(new PositiveInteger(1)).not.toBeInstanceOf(NonNegativeInteger);
    expect(new Uint8(1)).not.toBeInstanceOf(Int8);
    expect(new Float32(1)).not.toBeInstanceOf(Integer);
  });

  it('narrows a wider instance through parse', () => {
    expect(valueOf(Uint8.parse(new AnyNumber(200)))).toBeInstanceOf(Uint8);
    expect(issuesOf(Int8.parse(new Integer(200)))).toHaveLength(1);
  });

  it('reports the first rule a value breaks, with the value', () => {
    expect(issuesOf(PositiveInteger.parse('1'))).toStrictEqual([
      { message: 'must be a number (was "1")' },
    ]);
    expect(issuesOf(PositiveInteger.parse(Number.NaN))).toStrictEqual([
      { message: 'must be a finite number (was NaN)' },
    ]);
    expect(issuesOf(PositiveInteger.parse(1.5))).toStrictEqual([
      { message: 'must be a safe integer (was 1.5)' },
    ]);
    expect(issuesOf(PositiveInteger.parse(-0))).toStrictEqual([
      { message: 'must be a positive integer (was -0)' },
    ]);
    expect(issuesOf(Uint8.parse(256))).toStrictEqual([
      { message: 'must be an unsigned 8-bit integer (was 256)' },
    ]);
  });
});

describe('zero and NaN', () => {
  it('keeps -0 as given, so it differs from 0 by equals', () => {
    expect(Object.is(new NonNegativeInteger(-0).value, -0)).toBe(true);
    expect(new NonNegativeInteger(-0).equals(new NonNegativeInteger(0))).toBe(false);
  });

  it('treats NaN as equal to itself', () => {
    expect(new AnyNumber(Number.NaN).equals(new AnyNumber(Number.NaN))).toBe(true);
  });

  it('writes NaN and the infinities as null in JSON', () => {
    expect(
      JSON.stringify([new AnyNumber(Number.NaN), new AnyNumber(Number.POSITIVE_INFINITY)]),
    ).toBe('[null,null]');
  });
});
