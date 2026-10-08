import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import { AnyNumber, AnyString, n, Nominal, NominalError, OneOfSchema } from '../../src/index.ts';
import { issuesOf, outputOf, valueOf } from '../support/results.ts';

class OrderStatus extends AnyString.subtype('OneOfStatus', n.oneOf('draft', 'paid', 'shipped')) {}

class Rating extends AnyNumber.subtype('OneOfRating', n.oneOf(1, 2, 3)) {}

class Answer extends Nominal('OneOfAnswer', n.oneOf('yes', 'no', true, false, 0, 1.5, null)) {}

class Secret extends AnyString.subtype('OneOfSecret', n.oneOf('alpha', 'bravo'), {
  sensitive: true,
}) {}

type Library = typeof library;

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

describe('n.oneOf()', () => {
  it.each(['draft', 'paid', 'shipped'])('accepts the listed %j', (value) => {
    expect(new OrderStatus(value).value).toBe(value);
  });

  it.each([
    ['Draft', 'case counts'],
    ['draft ', 'a trailing space counts'],
    ['', 'an empty string'],
    ['dra', 'a prefix of a listed value'],
    ['draftx', 'a listed value with more after it'],
  ])('refuses %j: %s', (value) => {
    expect(OrderStatus.parse(value).ok).toBe(false);
  });

  it.each([4, 0, 1.5, '1', 'true', undefined, null, {}, [1], Number.NaN])(
    'refuses %o, which is not a listed number',
    (value) => {
      expect(Rating.parse(value).ok).toBe(false);
    },
  );

  it('compares numbers by value, so -0 is 0, as in JSON', () => {
    expect(new Answer(-0).value).toBe(-0);
    expect(Answer.parse(0).ok).toBe(true);
  });

  it.each([
    ['yes', true],
    [true, true],
    [false, true],
    [null, true],
    [1.5, true],
    ['true', false],
    [1, false],
    [undefined, false],
    ['null', false],
  ])('keeps kinds apart: %o is %s', (value, expected) => {
    expect(Answer.parse(value).ok).toBe(expected);
  });

  it('names the listed values and the rejected one', () => {
    expect(issuesOf(OrderStatus.parse('lost'))).toStrictEqual([
      { message: 'must be one of "draft", "paid", "shipped" (was "lost")' },
    ]);
    expect(issuesOf(Answer.parse(undefined))).toStrictEqual([
      { message: 'must be one of "yes", "no", true, false, 0, 1.5, null (was undefined)' },
    ]);
  });

  it('names a single value without "one of"', () => {
    const Admin = AnyString.subtype('OneOfAdmin', n.oneOf('admin'));

    expect(issuesOf(Admin.parse('user'))).toStrictEqual([
      { message: 'must be "admin" (was "user")' },
    ]);
  });

  it('reports a non-string under AnyString with the string check', () => {
    expect(issuesOf(OrderStatus.parse(42))).toStrictEqual([
      { message: 'must be one of "draft", "paid", "shipped" (was 42)' },
    ]);
  });

  it('leaves the value out for a sensitive type, and n.hideValues() does the same', () => {
    const [issue] = issuesOf(Secret.parse('charlie'));

    expect(issue?.message).toBe('must be one of "alpha", "bravo" (was a string of 7 characters)');
    expect(n.hideValues(issuesOf(OrderStatus.parse('lost')))).toStrictEqual([
      { message: 'must be one of "draft", "paid", "shipped" (was a string of 4 characters)' },
    ]);
  });

  it('throws NominalError from new', () => {
    expect(() => new OrderStatus('lost')).toThrow(NominalError);
  });

  it('is a Standard Schema on its own', () => {
    const size = n.oneOf('S', 'M', 'L');

    expect(outputOf(size['~standard'].validate('M'))).toBe('M');
    expect(size['~standard'].validate('XL')).toStrictEqual({
      issues: [{ message: 'must be one of "S", "M", "L" (was "XL")' }],
    });
    expect(size.accepts('L')).toBe(true);
    expect(size).toBeInstanceOf(OneOfSchema);
  });

  it('keeps the listed values, frozen and in order', () => {
    const size = n.oneOf('S', 'M', 'L');

    expect(size.values).toStrictEqual(['S', 'M', 'L']);
    expect(Object.isFrozen(size.values)).toBe(true);
  });

  it.each([
    [[], 'n.oneOf(): list at least one value'],
    [['a', 'a'], 'n.oneOf(): "a" is listed twice'],
    [[0, -0], 'n.oneOf(): -0 is listed twice'],
    [[1n], 'n.oneOf(): values must be strings, finite numbers, booleans or null (was 1n)'],
    [[Number.NaN], 'n.oneOf(): values must be strings, finite numbers, booleans or null (was NaN)'],
    [
      [Number.POSITIVE_INFINITY],
      'n.oneOf(): values must be strings, finite numbers, booleans or null (was Infinity)',
    ],
    [
      [undefined],
      'n.oneOf(): values must be strings, finite numbers, booleans or null (was undefined)',
    ],
    [[{}], 'n.oneOf(): values must be strings, finite numbers, booleans or null (was object)'],
    [[['a']], 'n.oneOf(): values must be strings, finite numbers, booleans or null (was array)'],
  ])('refuses the list %o', (values, message) => {
    expect(() => {
      Reflect.apply(n.oneOf, undefined, values);
    }).toThrow(new TypeError(message));
  });

  it('reads a listed number from text through fromString()', () => {
    expect(valueOf(n.of(Rating).fromString().parse('2')).value).toBe(2);
    expect(issuesOf(n.of(Rating).fromString().parse('4'))).toStrictEqual([
      { message: 'must be one of 1, 2, 3 (was 4)' },
    ]);
  });

  it('narrows a parent type with subtype() and replaces its rule with variant()', () => {
    const Final = OrderStatus.subtype('OneOfFinal', n.oneOf('shipped'));
    const Legacy = OrderStatus.variant('OneOfLegacy', n.oneOf('open', 'closed'));

    expect(Final.parse('shipped').ok).toBe(true);
    expect(issuesOf(Final.parse('paid'))).toStrictEqual([
      { message: 'must be "shipped" (was "paid")' },
    ]);
    expect(Legacy.parse('open').ok).toBe(true);
    expect(Legacy.parse('draft').ok).toBe(false);
  });

  it('checks a field of an object through a type or on its own', () => {
    const Order = n.object({ status: OrderStatus, size: n.oneOf('S', 'M') });

    expect(issuesOf(Order.parse({ status: 'lost', size: 'XL' }))).toStrictEqual([
      { message: 'must be one of "draft", "paid", "shipped" (was "lost")', path: ['status'] },
      { message: 'must be one of "S", "M" (was "XL")', path: ['size'] },
    ]);
    expect(valueOf(Order.parse({ status: 'paid', size: 'M' })).status).toBeInstanceOf(OrderStatus);
  });

  it('works with a type and a schema from another copy of the package', async () => {
    const copy = await anotherCopy();
    const Size = Nominal('OneOfCopySize', copy.n.oneOf('S', 'M'));
    const Color = copy.AnyString.subtype('OneOfCopyColor', n.oneOf('red', 'blue'));

    expect(Size.parse('S').ok).toBe(true);
    expect(issuesOf(Size.parse('L'))).toStrictEqual([
      { message: 'must be one of "S", "M" (was "L")' },
    ]);
    expect(Color.parse('red').ok).toBe(true);
    expect(Color.parse('green').ok).toBe(false);
  });
});
