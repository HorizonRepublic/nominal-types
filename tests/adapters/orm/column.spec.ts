import { describe, expect, it } from 'vitest';

import { columnKindOf } from '../../../src/adapters/orm/column.ts';
import {
  AnyBigInt,
  AnyBoolean,
  AnyNumber,
  AnyString,
  CountryCode,
  CurrencyCode,
  Base64,
  Base64Url,
  Email,
  FiniteNumber,
  Float32,
  HexColor,
  Int16,
  Int32,
  Int64,
  Int8,
  Integer,
  LanguageTag,
  MediaType,
  NegativeInteger,
  NegativeNumber,
  Nominal,
  NonNegativeInteger,
  NonNegativeNumber,
  NonPositiveInteger,
  NonPositiveNumber,
  PositiveInteger,
  PositiveNumber,
  satisfying,
  Uint16,
  Uint32,
  Uint64,
  Uint8,
  Url,
  Uuid,
} from '../../../src/index.ts';

const Percent = Nominal(
  'columns.Percent',
  satisfying(
    (value: unknown): value is number =>
      typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100,
    'a percent',
  ),
);
const Flag = Nominal(
  'columns.Flag',
  satisfying((value: unknown): value is boolean => typeof value === 'boolean', 'a flag'),
);
const Code = Nominal('columns.Code', /^[A-Z]{3}$/u);
// Takes fractions, but none below 1.
const Price = Nominal(
  'columns.Price',
  satisfying(
    (value: unknown): value is number => typeof value === 'number' && value >= 1,
    'a price',
  ),
);

describe('columnKindOf', () => {
  it.each([
    [Email, { kind: 'text', length: 254 }],
    [Uuid, { kind: 'uuid' }],
    [Url, { kind: 'text' }],
    [CountryCode, { kind: 'text', length: 2 }],
    [CurrencyCode, { kind: 'text', length: 3 }],
    [LanguageTag, { kind: 'text' }],
    [AnyString, { kind: 'text' }],
    [MediaType, { kind: 'text' }],
    [HexColor, { kind: 'text', length: 9 }],
    [Base64, { kind: 'text' }],
    [Base64Url, { kind: 'text' }],
    [Int8, { kind: 'integer' }],
    [Int16, { kind: 'integer' }],
    [Int32, { kind: 'integer' }],
    [Uint32, { kind: 'bigint' }],
    [Integer, { kind: 'bigint' }],
    [PositiveInteger, { kind: 'bigint' }],
    [NegativeInteger, { kind: 'bigint' }],
    [NonNegativeInteger, { kind: 'bigint' }],
    [NonPositiveInteger, { kind: 'bigint' }],
    [Uint8, { kind: 'integer' }],
    [Uint16, { kind: 'integer' }],
    [AnyNumber, { kind: 'double' }],
    [FiniteNumber, { kind: 'double' }],
    [PositiveNumber, { kind: 'double' }],
    [NegativeNumber, { kind: 'double' }],
    [NonNegativeNumber, { kind: 'double' }],
    [NonPositiveNumber, { kind: 'double' }],
    [Float32, { kind: 'double' }],
    [AnyBoolean, { kind: 'boolean' }],
    [Int64, { kind: 'bigint' }],
    [Uint64, { kind: 'decimal', precision: 20 }],
    [AnyBigInt, { kind: 'text', length: 1000 }],
  ])('stores %o in %o', (target, kind) => {
    expect(columnKindOf(target)).toStrictEqual(kind);
  });

  it('reads a type declared from scratch by what it accepts', () => {
    expect(columnKindOf(Percent)).toStrictEqual({ kind: 'integer' });
    expect(columnKindOf(Flag)).toStrictEqual({ kind: 'boolean' });
    expect(columnKindOf(Code)).toStrictEqual({ kind: 'text' });
    expect(columnKindOf(Price)).toStrictEqual({ kind: 'double' });
  });
});
