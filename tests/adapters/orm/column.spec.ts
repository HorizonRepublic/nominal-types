import { describe, expect, it } from 'vitest';

import { columnKindOf } from '../../../src/adapters/orm/column.ts';
import {
  AnyBigInt,
  AnyBoolean,
  AnyNumber,
  AnyString,
  Email,
  Float32,
  Int16,
  Int32,
  Int64,
  Int8,
  Integer,
  Nominal,
  PositiveInteger,
  satisfying,
  Uint32,
  Uint64,
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

describe('columnKindOf', () => {
  it.each([
    [Email, { kind: 'text', length: 254 }],
    [Uuid, { kind: 'uuid' }],
    [Url, { kind: 'text' }],
    [AnyString, { kind: 'text' }],
    [Int8, { kind: 'integer' }],
    [Int16, { kind: 'integer' }],
    [Int32, { kind: 'integer' }],
    [Uint32, { kind: 'bigint' }],
    [Integer, { kind: 'bigint' }],
    [PositiveInteger, { kind: 'bigint' }],
    [AnyNumber, { kind: 'double' }],
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
  });
});
