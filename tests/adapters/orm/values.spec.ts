import { describe, expect, it } from 'vitest';

import { columnKindOf } from '../../../src/adapters/orm/column.ts';
import { readerOf, writerOf } from '../../../src/adapters/orm/values.ts';
import {
  AnyBoolean,
  Email,
  Int64,
  NominalError,
  PositiveInteger,
  Uuid,
} from '../../../src/index.ts';

const reader = (
  target: Parameters<typeof columnKindOf>[0],
  trusted = false,
): ((raw: unknown) => unknown) => readerOf(target, columnKindOf(target), trusted);

describe('reading stored values', () => {
  it('passes null and undefined through', () => {
    expect(reader(Email)(null)).toBeNull();
    expect(reader(Email)(undefined)).toBeUndefined();
  });

  it('builds instances, numbers from text and booleans from integers', () => {
    expect(reader(Email)('a@b.co')).toStrictEqual(new Email('a@b.co'));
    expect(reader(PositiveInteger)('42')).toStrictEqual(new PositiveInteger(42));
    expect(reader(PositiveInteger)(42)).toStrictEqual(new PositiveInteger(42));
    expect(reader(Int64)(42)).toStrictEqual(new Int64(42n));
    expect(reader(Int64)('9007199254740993')).toStrictEqual(new Int64(9_007_199_254_740_993n));
    expect(reader(AnyBoolean)(1)).toStrictEqual(new AnyBoolean(true));
    expect(reader(AnyBoolean)('f')).toStrictEqual(new AnyBoolean(false));
    expect(reader(AnyBoolean)(true)).toStrictEqual(new AnyBoolean(true));
  });

  it('throws a NominalError for a stored value the type refuses', () => {
    expect(() => reader(Email)('bad')).toThrow(
      new NominalError('nominal.Email', [{ message: 'must be an email address (was "bad")' }]),
    );
    expect(() => reader(AnyBoolean)(2)).toThrow(NominalError);
  });

  it('builds without a check when trusted', () => {
    expect(reader(Email, true)('bad')).toBeInstanceOf(Email);
  });
});

describe('writing values', () => {
  const write = writerOf(Email, undefined);

  it('passes null and undefined through', () => {
    expect(write(null)).toBeNull();
    expect(write(undefined)).toBeUndefined();
  });

  it('stores an instance and a valid plain value by their JSON', () => {
    expect(write(new Email('a@b.co'))).toBe('a@b.co');
    expect(write('a@b.co')).toBe('a@b.co');
    expect(writerOf(Int64, undefined)(new Int64(7n))).toBe('7');
    expect(writerOf(Uuid, undefined)(new Uuid('0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F'))).toBe(
      '0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F',
    );
  });

  it('stores what serialize gives, for a plain value too', () => {
    const lower = writerOf(Email, (email: Email) => email.value.toLowerCase());

    expect(lower(new Email('Jane@Example.com'))).toBe('jane@example.com');
    expect(lower('Jane@Example.com')).toBe('jane@example.com');
  });

  it('passes a plain value the type refuses as it is, such as a pattern', () => {
    expect(write('%@example.com')).toBe('%@example.com');
  });
});
