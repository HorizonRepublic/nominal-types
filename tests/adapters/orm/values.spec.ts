import { describe, expect, it } from 'vitest';

import { columnKindOf } from '../../../src/adapters/orm/column.ts';
import { jsonTextOf, readerOf, writerOf } from '../../../src/adapters/orm/values.ts';
import {
  AnyBoolean,
  DecimalString,
  Email,
  Int64,
  Money,
  n,
  Nominal,
  NominalError,
  PositiveInteger,
  Uuid,
} from '../../../src/index.ts';

const Ledger = Nominal('values.Ledger', n.object({ owner: Email, balance: Int64 }));
const manyDigits = '-12345678901234567890123456789.123456789012345678901234567890';

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
      new NominalError('nominal.Email', [
        { message: 'must be an email address (was a string of 3 characters)' },
      ]),
    );
    expect(() => reader(AnyBoolean)(2)).toThrow(NominalError);
  });

  it('refuses a big integer the driver returned as a number that lost digits', () => {
    expect(reader(Int64)(Number.MAX_SAFE_INTEGER)).toStrictEqual(new Int64(2n ** 53n - 1n));
    expect(() => reader(Int64)(2 ** 53)).toThrow(NominalError);
    expect(() => reader(Int64, true)(2 ** 53)).toThrow(NominalError);
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

describe('JSON columns', () => {
  const read = reader(Money);
  const write = writerOf(Money, undefined);

  it('reads JSON text and values the driver already parsed', () => {
    const money = new Money({ amount: '12.34', currency: 'EUR' });

    expect(read('{"amount":"12.34","currency":"EUR"}')).toStrictEqual(money);
    expect(read({ amount: '12.34', currency: 'EUR' })).toStrictEqual(money);
    expect(read(null)).toBeNull();
  });

  it('throws a NominalError for text that is no JSON, and for JSON the type refuses', () => {
    expect(() => read('{"amount":')).toThrow(NominalError);
    expect(() => read('{"amount":"1.234","currency":"EUR"}')).toThrow(
      'must have at most 2 digits after the point in EUR',
    );
  });

  it('checks the fields even when trusted, since they are built from the JSON', () => {
    expect(() => reader(Money, true)('{"amount":"x","currency":"EUR"}')).toThrow(NominalError);
    expect(reader(Money, true)('{"amount":"1","currency":"EUR"}')).toBeInstanceOf(Money);
  });

  it('writes JSON text with every instance inside as its JSON, big integers as strings', () => {
    expect(jsonTextOf(write(new Money({ amount: '12.34', currency: 'EUR' })))).toBe(
      '{"amount":"12.34","currency":"EUR"}',
    );
    expect(jsonTextOf(writerOf(Ledger, undefined)({ owner: 'a@b.co', balance: 2n ** 60n }))).toBe(
      '{"owner":"a@b.co","balance":"1152921504606846976"}',
    );
  });

  it('writes what serialize gives as JSON too', () => {
    const canonical = writerOf(Money, (money: Money) => money.canonical());

    expect(jsonTextOf(canonical(new Money({ amount: '12.5', currency: 'EUR' })))).toBe(
      '{"amount":"12.50","currency":"EUR"}',
    );
  });

  it('passes a value the type refuses as it is, and text as text', () => {
    expect(jsonTextOf(write('{"currency":"EUR"}'))).toBe('{"currency":"EUR"}');
    expect(jsonTextOf(null)).toBeNull();
  });
});

describe('decimal columns', () => {
  const read = reader(DecimalString);

  it('reads the text the driver returns as it is, every digit kept', () => {
    expect(read(manyDigits)).toStrictEqual(new DecimalString(manyDigits));
    expect(read('12.50')).toStrictEqual(new DecimalString('12.50'));
    expect(read(12n)).toStrictEqual(new DecimalString('12'));
  });

  it('refuses a number, which may have lost digits, even when trusted', () => {
    const lost = new NominalError('nominal.DecimalString', [
      {
        message:
          'must come from the database as text, since a number may have lost digits (was 12.34)',
      },
    ]);

    expect(() => read(12.34)).toThrow(lost);
    expect(() => reader(DecimalString, true)(12.34)).toThrow(lost);
    expect(() => read(1)).toThrow(NominalError);
  });

  it('writes the text', () => {
    const write = writerOf(DecimalString, undefined);

    expect(write(new DecimalString(manyDigits))).toBe(manyDigits);
  });
});
