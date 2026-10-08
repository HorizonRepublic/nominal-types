import { describe, expect, it } from 'vitest';

import { n, NonBlankString, PositiveInteger, UnionSchema } from '../../src/index.ts';
import {
  callAnyway,
  card,
  Card,
  invoice,
  Payment,
  withinCapacity,
  wrongTag,
} from '../support/object-fixtures.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const inherited = (fields: object): object => {
  const input = {};

  Reflect.setPrototypeOf(input, fields);

  return input;
};

const unionOf = (key: unknown, variants: unknown): unknown => callAnyway(n, 'union', key, variants);

const Booking = n.union('kind', {
  room: n.object({ guests: PositiveInteger, capacity: PositiveInteger }, withinCapacity),
  change: n
    .object({ guests: PositiveInteger, capacity: PositiveInteger }, withinCapacity)
    .partial(),
});

describe('n.union', () => {
  it('checks the object with the variant its tag picks, and keeps the tag first', () => {
    expect(valueOf(Payment.parse(card))).toStrictEqual({
      method: 'card',
      token: new NonBlankString('tok_1'),
    });
    expect(Object.keys(valueOf(Payment.parse(invoice)))).toStrictEqual(['method', 'email']);
  });

  it('reports the issues of the variant with paths from the top', () => {
    expect(issuesOf(Payment.parse({ method: 'card', token: ' ' }))).toStrictEqual([
      { message: 'must be a non-blank string (was " ")', path: ['token'] },
    ]);
    expect(issuesOf(Payment.parse({ method: 'invoice' }))).toStrictEqual([
      { message: 'is required', path: ['email'] },
    ]);
  });

  it('reports an unknown or missing tag once, under the key, and nothing else', () => {
    expect(issuesOf(Payment.parse({ method: 'cash', token: 1 }))).toStrictEqual(wrongTag('"cash"'));
    expect(issuesOf(Payment.parse({ token: 'tok_1' }))).toStrictEqual(wrongTag('undefined'));
    expect(issuesOf(Payment.parse({ method: undefined }))).toStrictEqual(wrongTag('undefined'));
  });

  it('compares tags with ===, so case and other kinds of value do not match', () => {
    expect(issuesOf(Payment.parse({ method: 'Card' }))).toStrictEqual(wrongTag('"Card"'));
    expect(issuesOf(Payment.parse({ method: 1 }))).toStrictEqual(wrongTag('1'));
    expect(issuesOf(Payment.parse({ method: null }))).toStrictEqual(wrongTag('null'));
    expect(issuesOf(Payment.parse({ method: ['card'] }))).toStrictEqual(wrongTag('array'));
    expect(issuesOf(Payment.parse({ method: { toString: () => 'card' } }))).toStrictEqual(
      wrongTag('object'),
    );
  });

  it('reads own keys only', () => {
    expect(issuesOf(Payment.parse(inherited(card)))).toStrictEqual(wrongTag('undefined'));
    expect(issuesOf(Payment.parse({ method: 'toString' }))).toStrictEqual(wrongTag('"toString"'));
    expect(issuesOf(Payment.parse({ method: '__proto__' }))).toStrictEqual(wrongTag('"__proto__"'));
  });

  it('refuses what is not an object, with no path', () => {
    expect(issuesOf(Payment.parse([]))).toStrictEqual([
      { message: 'must be an object (was array)' },
    ]);
    expect(issuesOf(Payment.parse(null))).toStrictEqual([
      { message: 'must be an object (was null)' },
    ]);
    expect(issuesOf(Payment.parse('card'))).toStrictEqual([
      { message: 'must be an object (was "card")' },
    ]);
  });

  it('cuts a long tag in the message, and hides it where values are hidden', () => {
    expect(issuesOf(Payment.parse({ method: 'x'.repeat(100) }))).toStrictEqual(
      wrongTag(`a string of 100 characters starting "${'x'.repeat(32)}"…`),
    );
    expect(n.hideValues(issuesOf(Payment.parse({ method: 'cash' })))).toStrictEqual(
      wrongTag('a string of 4 characters'),
    );
  });

  it('names the only tag of a union of one', () => {
    expect(issuesOf(n.union('kind', { a: Card }).parse({ kind: 'b' }))).toStrictEqual([
      { message: 'must be "a" (was "b")', path: ['kind'] },
    ]);
  });

  it('replaces a field the variant declares under the key by the tag', () => {
    expect(valueOf(Payment.parse(invoice)).method).toBe('invoice');
  });

  it('lets a strict variant take the tag, and refuse other keys', () => {
    const Strict = n.union('method', { card: Card.strict() });

    expect(Strict.parse(card).ok).toBe(true);
    expect(issuesOf(Strict.parse({ ...card, extra: 1 }))).toStrictEqual([
      { message: 'is not allowed', path: ['extra'] },
    ]);
  });

  it('keeps the constraints and partial() of a variant', () => {
    expect(issuesOf(Booking.parse({ kind: 'room', guests: 3, capacity: 2 }))).toStrictEqual([
      { message: 'must not exceed the capacity', path: ['guests'] },
    ]);
    expect(Booking.parse({ kind: 'change', guests: 3 }).ok).toBe(true);
    expect(Booking.parse({ kind: 'change' }).ok).toBe(true);
  });

  it('takes a variant whose tag is __proto__ when it is an own key', () => {
    const Odd = n.union('kind', Object.fromEntries([['__proto__', Card]]));
    const value = valueOf(Odd.parse({ kind: '__proto__', token: 'a' }));

    expect(Odd.tags).toStrictEqual(['__proto__']);
    expect(Object.getOwnPropertyDescriptor(value, 'kind')?.value).toBe('__proto__');
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  });

  it('refuses no variants, and variants that are not n.object() schemas', () => {
    const none = new TypeError('n.union(): list at least one variant');

    expect(() => unionOf('kind', {})).toThrow(none);
    expect(() => unionOf('kind', null)).toThrow(none);
    expect(() => unionOf('kind', { a: n.of(PositiveInteger) })).toThrow(
      new TypeError('n.union(): the variant "a" must be an n.object() schema (was object)'),
    );
    expect(() => unionOf('kind', { a: PositiveInteger })).toThrow(
      new TypeError('n.union(): the variant "a" must be an n.object() schema (was function)'),
    );
    expect(() => unionOf('kind', { a: Payment })).toThrow(TypeError);
  });

  it('refuses a key that is not a string, or is __proto__', () => {
    expect(() => unionOf(1, { a: Card })).toThrow(
      new TypeError('n.union(): the key must be a string other than __proto__ (was 1)'),
    );
    expect(() => unionOf('__proto__', { a: Card })).toThrow(
      new TypeError('n.union(): the key must be a string other than __proto__ (was "__proto__")'),
    );
  });

  it('leaves the variants as they were, and tells its key and tags', () => {
    expect(Card.keys).toStrictEqual(['token']);
    expect(Card.parse({ token: 'a' }).ok).toBe(true);
    expect(Payment.key).toBe('method');
    expect(Payment.tags).toStrictEqual(['card', 'invoice']);
    expect(Object.isFrozen(Payment.tags)).toBe(true);
    expect(Payment).toBeInstanceOf(UnionSchema);
    expect(n.isObject(Payment)).toBe(false);
  });
});
