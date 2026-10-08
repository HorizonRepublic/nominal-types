import { describe, expect, it, vi } from 'vitest';

import {
  AnyString,
  CurrencyCode,
  DecimalString,
  Email,
  n,
  NonEmptyString,
  PositiveInteger,
  Uuid,
} from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { handWritten, issuesOf, stringOnly, valueOf } from '../support/results.ts';

const prices = n.record(CurrencyCode, DecimalString);
const sizes = n.record(n.oneOf('s', 'm', 'l'), PositiveInteger);
const counts = n.record(NonEmptyString, PositiveInteger);
const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

resetConfigurationAfterEach();

describe('n.record()', () => {
  it('checks every key and every value, and gives a new object of the values', () => {
    const input = { EUR: '12.50', USD: '13.10' };
    const value = valueOf(prices.parse(input));

    expect(n.plain(value)).toStrictEqual({ EUR: '12.50', USD: '13.10' });
    expect(value).not.toBe(input);
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(value['EUR']).toBeInstanceOf(DecimalString);
  });

  it('accepts an empty object when no key is listed', () => {
    expect(valueOf(prices.parse({}))).toStrictEqual({});
  });

  it('reports a bad key with the key in its path, and every bad value', () => {
    expect(issuesOf(prices.parse({ euro: '1', USD: 'x', GBP: '2' }))).toStrictEqual([
      { message: 'key must be an ISO 4217 currency code (was "euro")', path: ['euro'] },
      { message: 'must be a decimal number as text (was "x")', path: ['USD'] },
    ]);
  });

  it('refuses anything but a plain object, arrays included', () => {
    for (const input of [null, undefined, 'EUR', 1, true, [], [['EUR', '1']]]) {
      expect(prices.parse(input).ok).toBe(false);
      expect(prices.accepts(input)).toBe(false);
    }

    expect(issuesOf(prices.parse([]))).toStrictEqual([
      { message: 'must be an object (was array)' },
    ]);
  });

  it('reads only own keys, and ignores symbols', () => {
    const inherited: unknown = Object.create({ EUR: '1' });

    expect(valueOf(prices.parse(inherited))).toStrictEqual({});
    expect(n.plain(valueOf(prices.parse({ [Symbol('x')]: 'nope', EUR: '1' })))).toStrictEqual({
      EUR: '1',
    });
  });

  it('refuses a __proto__ key, so a value never gets another prototype', () => {
    const input: unknown = JSON.parse('{"__proto__": {"polluted": true}, "EUR": "1"}');

    expect(issuesOf(prices.parse(input))).toStrictEqual([
      { message: 'is not allowed', path: ['__proto__'] },
    ]);
    expect(prices.accepts(input)).toBe(false);
    expect(Reflect.get({}, 'polluted')).toBeUndefined();
  });

  it('keeps constructor and prototype as plain keys', () => {
    const value = valueOf(counts.parse({ constructor: 1, prototype: 2, toString: 3 }));

    expect(Object.keys(value)).toStrictEqual(['constructor', 'prototype', 'toString']);
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(counts.stringify(value)).toBe('{"constructor":1,"prototype":2,"toString":3}');
  });

  it('counts a value given as undefined as a missing key', () => {
    const loose = n.record(NonEmptyString, n.of(PositiveInteger).optional());

    expect(issuesOf(counts.parse({ a: undefined }))).toStrictEqual([
      { message: 'is required', path: ['a'] },
    ]);
    expect(counts.accepts({ a: undefined })).toBe(false);
    expect(n.plain(valueOf(loose.parse({ a: undefined, b: 2 })))).toStrictEqual({ b: 2 });
    expect(loose.accepts({ a: undefined })).toBe(true);
  });

  it('takes a schema of strings as the key, and any target as the value', () => {
    const byEmail = n.record(n.of(Email), n.object({ id: Uuid }));

    expect(n.plain(valueOf(byEmail.parse({ 'jane@example.com': { id } })))).toStrictEqual({
      'jane@example.com': { id },
    });
    expect(issuesOf(byEmail.parse({ jane: { id: 'x' } }))).toStrictEqual([
      { message: 'key must be an email address (was a string of 4 characters)', path: ['jane'] },
    ]);
    expect(issuesOf(byEmail.parse({ 'jane@example.com': { id: 'x' } }))).toStrictEqual([
      { message: 'must be a UUID (was "x")', path: ['jane@example.com', 'id'] },
    ]);
  });

  it('leaves the value of a sensitive key type out of its message', () => {
    expect(issuesOf(n.record(Email, AnyString).parse({ jane: 'x' }))).toStrictEqual([
      { message: 'key must be an email address (was a string of 4 characters)', path: ['jane'] },
    ]);
  });

  it('nests records, with the full path in each issue', () => {
    const nested = n.record(NonEmptyString, counts);

    expect(issuesOf(nested.parse({ a: { b: 0 } }))).toStrictEqual([
      { message: 'must be a positive integer (was 0)', path: ['a', 'b'] },
    ]);
  });

  it('refuses a key and a value that are not types or schemas, and keys that are not strings', () => {
    expect(() => {
      Reflect.apply(n.record, undefined, ['key', PositiveInteger]);
    }).toThrow(new TypeError('n.record(): the key must be a nominal type or a schema (was "key")'));
    expect(() => {
      Reflect.apply(n.record, undefined, [AnyString, {}]);
    }).toThrow(
      new TypeError('n.record(): the value must be a nominal type or a schema (was object)'),
    );
    expect(() => n.record(PositiveInteger, AnyString)).toThrow(
      new TypeError('n.record(): the key must be a type or schema of strings'),
    );
    expect(() => n.record(n.oneOf('a', 1), AnyString)).toThrow(
      new TypeError('n.record(): the key must be a type or schema of strings'),
    );
    expect(() => n.record(n.oneOf('a', '__proto__'), AnyString)).toThrow(
      new TypeError('n.record(): a key cannot be named __proto__'),
    );
  });

  it('refuses two keys its key schema makes one', () => {
    configured({ normalize: { trimStrings: true } }, () => {
      const trimmed = n.record(NonEmptyString, PositiveInteger);

      expect(issuesOf(trimmed.parse({ a: 1, ' a': 2 }))).toStrictEqual([
        { message: 'must not repeat a key', path: [' a'] },
      ]);
      expect(issuesOf(trimmed.parse({ ' a': 1, a: 2 }))).toStrictEqual([
        { message: 'must not repeat a key', path: ['a'] },
      ]);
      expect(trimmed.accepts({ a: 1, ' a': 2 })).toBe(false);
      expect(Object.keys(valueOf(trimmed.parse({ ' a ': 1 })))).toStrictEqual(['a']);
      expect(trimmed.accepts({ ' a ': 1, b: 2 })).toBe(true);
    });
  });
});

describe('n.record() with listed keys', () => {
  it('requires every listed key, as a TypeScript Record does, and refuses others', () => {
    expect(n.plain(valueOf(sizes.parse({ s: 1, m: 2, l: 3 })))).toStrictEqual({
      s: 1,
      m: 2,
      l: 3,
    });
    expect(issuesOf(sizes.parse({ m: 2, xl: 4 }))).toStrictEqual([
      { message: 'key must be one of "s", "m", "l" (was "xl")', path: ['xl'] },
      { message: 'is required', path: ['s'] },
      { message: 'is required', path: ['l'] },
    ]);
    expect(issuesOf(sizes.parse({ s: 1, m: undefined, l: 3 }))).toStrictEqual([
      { message: 'is required', path: ['m'] },
    ]);
    expect(sizes.accepts({ s: 1, m: 2 })).toBe(false);
    expect(sizes.keys).toStrictEqual(['s', 'm', 'l']);
    expect(counts.keys).toBeUndefined();
  });

  it('lets the keys be missing after partial()', () => {
    const some = sizes.partial();

    expect(n.plain(valueOf(some.parse({ m: 2 })))).toStrictEqual({ m: 2 });
    expect(valueOf(some.parse({}))).toStrictEqual({});
    expect(some.accepts({ m: 2 })).toBe(true);
    expect(some.parse({ xl: 1 }).ok).toBe(false);
  });

  it('keeps the keys of a nominal type with listed values open', () => {
    expect(prices.keys).toBeUndefined();
    expect(n.record(n.of(CurrencyCode), AnyString).keys).toBeUndefined();
  });
});

describe('min() and max()', () => {
  it('checks the number of keys first, at the boundaries', () => {
    const bounded = counts.min(1).max(2);

    expect(bounded.parse({ a: 1 }).ok).toBe(true);
    expect(bounded.parse({ a: 1, b: 2 }).ok).toBe(true);
    expect(issuesOf(bounded.parse({}))).toStrictEqual([
      { message: 'must have at least 1 key (was 0)' },
    ]);
    expect(issuesOf(bounded.parse({ a: 0, b: 0, c: 0 }))).toStrictEqual([
      { message: 'must have at most 2 keys (was 3)' },
    ]);
    expect(issuesOf(counts.min(2).max(2).parse({ a: 1 }))).toStrictEqual([
      { message: 'must have 2 keys (was 1)' },
    ]);
    expect(bounded.accepts({})).toBe(false);
    expect(bounded.accepts({ a: 1, b: 2, c: 3 })).toBe(false);
  });

  it('refuses counts that are not whole numbers from 0 up, or that cross', () => {
    expect(() => counts.min(-1)).toThrow(
      new TypeError('min(): the count must be a whole number from 0 up (was -1)'),
    );
    expect(() => counts.max(1.5)).toThrow(
      new TypeError('max(): the count must be a whole number from 0 up (was 1.5)'),
    );
    expect(() => counts.max(1).min(2)).toThrow(
      new TypeError('min(): the record would need at least 2 and at most 1 keys'),
    );
  });

  it('refuses a huge record by its count before reading any key', () => {
    const validate = vi.fn<typeof stringOnly>(stringOnly);
    const watched = n.record(handWritten(validate), AnyString).max(10);
    const huge = Object.fromEntries(
      Array.from({ length: 100_000 }, (_, index) => [`k${index}`, 'v']),
    );

    expect(watched.parse(huge).ok).toBe(false);
    expect(watched.accepts(huge)).toBe(false);
    expect(validate).not.toHaveBeenCalled();
  });

  it('parses 100,000 keys quickly', () => {
    const huge = Object.fromEntries(
      Array.from({ length: 100_000 }, (_, index) => [`k${index}`, index + 1]),
    );
    const started = performance.now();

    expect(counts.parse(huge).ok).toBe(true);
    expect(counts.accepts(huge)).toBe(true);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
