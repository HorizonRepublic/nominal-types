import type { StandardSchemaV1 } from '@standard-schema/spec';
import { type } from 'arktype';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Email, Nominal, PositiveInteger, constraint, schemaOf, Uint8 } from '../../src/index.ts';
import { issuesOf, outputOf, valueOf } from '../support/results.ts';

const endAfterStart = constraint(
  { start: PositiveInteger, end: PositiveInteger },
  ({ start, end }) => end > start,
  { path: 'end' },
);

const notBelow = constraint({ min: Uint8, max: Uint8 }, ({ min, max }) => max >= min || 'too low', {
  path: 'max',
});

const withinBudget = constraint(
  { prices: schemaOf(PositiveInteger).array(), budget: PositiveInteger },
  ({ prices, budget }) =>
    prices.reduce((sum, price) => sum + price.value, 0) <= budget.value || 'over budget',
  { path: 'prices' },
);

const optionalMin = constraint(
  { min: schemaOf(Uint8).optional(), max: Uint8 },
  ({ min, max }) => min === undefined || max >= min,
);

const validate = (schema: StandardSchemaV1, input: unknown): StandardSchemaV1.Result<unknown> => {
  const result = schema['~standard'].validate(input);

  if (result instanceof Promise) {
    throw new TypeError('expected a synchronous result');
  }

  return result;
};

const issues = (schema: StandardSchemaV1, input: unknown): readonly StandardSchemaV1.Issue[] =>
  validate(schema, input).issues ?? [];

describe('constraint', () => {
  describe('the check', () => {
    it('accepts fields that agree, also past one digit', () => {
      expect(issues(endAfterStart, { start: 9, end: 10 })).toStrictEqual([]);
    });

    it('rejects fields that disagree, with the default message on the given path', () => {
      expect(issues(endAfterStart, { start: 10, end: 9 })).toStrictEqual([
        { message: 'must agree with start', path: ['end'] },
      ]);
    });

    it('rejects equal fields where the check is strict', () => {
      expect(issues(endAfterStart, { start: 5, end: 5 })).toHaveLength(1);
    });

    it('uses the message the check returns', () => {
      expect(issues(notBelow, { min: 2, max: 1 })).toStrictEqual([
        { message: 'too low', path: ['max'] },
      ]);
    });

    it('uses the message from the options when the check returns false', () => {
      const rule = constraint({ a: Uint8, b: Uint8 }, ({ a, b }) => a < b, { message: 'a first' });

      expect(issues(rule, { a: 2, b: 1 })).toStrictEqual([{ message: 'a first' }]);
    });

    it('puts the issue on the object when no path is given', () => {
      const rule = constraint({ a: Uint8, b: Uint8 }, ({ a, b }) => a < b);

      expect(issues(rule, { a: 2, b: 1 })).toStrictEqual([{ message: 'a, b must agree' }]);
    });

    it('takes a path deeper than one key', () => {
      const rule = constraint({ a: Uint8, b: Uint8 }, () => false, { path: ['b', 'value', 0] });

      expect(issues(rule, { a: 1, b: 1 })).toStrictEqual([
        { message: 'must agree with a', path: ['b', 'value', 0] },
      ]);
    });

    it('treats an empty message from the check as the message', () => {
      const rule = constraint({ a: Uint8 }, () => '');

      expect(issues(rule, { a: 1 })).toStrictEqual([{ message: '' }]);
    });

    it('receives instances of the listed types', () => {
      const check = vi.fn<() => boolean>(() => true);
      const rule = constraint({ email: Email, count: PositiveInteger }, check);

      validate(rule, { email: 'jane@example.com', count: 2 });

      expect(check).toHaveBeenCalledWith({
        email: expect.any(Email) as unknown,
        count: expect.any(PositiveInteger) as unknown,
      });
    });
  });

  describe('fields that fail on their own', () => {
    it('reports each failed field under its key and skips the check', () => {
      const check = vi.fn<() => boolean>(() => true);
      const rule = constraint({ start: PositiveInteger, end: PositiveInteger }, check);

      expect(issues(rule, { start: 0, end: 'x' })).toStrictEqual([
        { message: 'must be a positive integer (was 0)', path: ['start'] },
        { message: 'must be a number (was "x")', path: ['end'] },
      ]);
      expect(check).not.toHaveBeenCalled();
    });

    it('reports a missing field', () => {
      expect(issues(endAfterStart, { start: 1 })).toStrictEqual([
        { message: 'must be a number (was undefined)', path: ['end'] },
      ]);
    });

    it('keeps the path inside a field', () => {
      const rule = constraint({ ids: schemaOf(PositiveInteger).array() }, () => true);

      expect(issues(rule, { ids: [1, 0] })).toStrictEqual([
        { message: 'must be a positive integer (was 0)', path: ['ids', 1] },
      ]);
    });

    it.each([
      ['a string', 'x', 'must be an object (was "x")'],
      ['null', null, 'must be an object (was null)'],
      ['an array', [], 'must be an object (was array)'],
      ['undefined', undefined, 'must be an object (was undefined)'],
    ])('rejects %s in place of the object', (_name, input, message) => {
      expect(issues(endAfterStart, input)).toStrictEqual([{ message }]);
    });
  });

  describe('the value it gives back', () => {
    it('puts the checked values in place and keeps the other keys', () => {
      const input = { start: 1, end: 2, note: 'kept' };
      const value = outputOf(endAfterStart['~standard'].validate(input));

      expect(value).toStrictEqual({
        start: new PositiveInteger(1),
        end: new PositiveInteger(2),
        note: 'kept',
      });
      expect(value).not.toBe(input);
      expect(input).toStrictEqual({ start: 1, end: 2, note: 'kept' });
    });

    it('passes instances through', () => {
      const start = new PositiveInteger(1);
      const value = outputOf(endAfterStart['~standard'].validate({ start, end: 2 }));

      expect(value.start).toBe(start);
    });
  });

  describe('fields of other kinds', () => {
    it('takes a schemaOf() array and sums its items', () => {
      expect(issues(withinBudget, { prices: [3, 4], budget: 7 })).toStrictEqual([]);
      expect(issues(withinBudget, { prices: [3, 5], budget: 7 })).toStrictEqual([
        { message: 'over budget', path: ['prices'] },
      ]);
    });

    it('takes an optional field and runs the check without it', () => {
      expect(issues(optionalMin, { max: 1 })).toStrictEqual([]);
      expect(issues(optionalMin, { min: 2, max: 1 })).toHaveLength(1);
    });

    it('takes a schema from another library for a plain field', () => {
      const rule = constraint(
        { limit: type('number'), used: PositiveInteger },
        ({ limit, used }) => {
          expectTypeOf(limit).toEqualTypeOf<number>();

          return used.value <= limit;
        },
      );

      expect(issues(rule, { limit: 3, used: 2 })).toStrictEqual([]);
      expect(issues(rule, { limit: 'x', used: 2 })).toStrictEqual([
        { message: 'must be a number (was a string)', path: ['limit'] },
      ]);
    });

    it('throws for a field schema that answers asynchronously', () => {
      const later: StandardSchemaV1<unknown, unknown> = {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: (value) => Promise.resolve({ value }),
        },
      };

      expect(() =>
        validate(
          constraint({ a: later }, () => true),
          { a: 1 },
        ),
      ).toThrow(new TypeError('constraint: asynchronous schemas are not supported'));
    });
  });

  describe('as the rule of a type', () => {
    class AgeRange extends Nominal(
      'AgeRange',
      constraint(
        { min: Uint8, max: Uint8 },
        ({ min, max }) => max >= min || 'must not be below min',
        {
          path: 'max',
        },
      ),
    ) {}

    it('builds an instance holding instances, frozen', () => {
      const range = new AgeRange({ min: 18, max: 65 });

      expect(range.value.max).toBeInstanceOf(Uint8);
      expect(Object.isFrozen(range.value)).toBe(true);
      expect(String(range)).toBe('{"min":18,"max":65}');
      expect(range.equals(new AgeRange({ min: 18, max: 65 }))).toBe(true);
    });

    it('throws with the path of the issue in the message', () => {
      expect(() => new AgeRange({ min: 65, max: 18 })).toThrow(
        'AgeRange: max: must not be below min',
      );
    });

    it('rejects a range that disagrees', () => {
      expect(issuesOf(AgeRange.parse({ min: 65, max: 18 }))).toStrictEqual([
        { message: 'must not be below min', path: ['max'] },
      ]);
    });

    it('types the value from the fields', () => {
      expectTypeOf(valueOf(AgeRange.parse({ min: 1, max: 2 })).value.max).toEqualTypeOf<Uint8>();
    });
  });
});
