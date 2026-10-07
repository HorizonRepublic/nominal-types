import * as v from 'valibot';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { constrainValibot, toValibot } from '../../../src/adapters/valibot/index.ts';
import type * as library from '../../../src/index.ts';
import { constraint, Email, Nominal, objectOf, PositiveInteger, Uuid } from '../../../src/index.ts';
import { edgeSamples, sampleTypes } from '../../support/samples.ts';

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

const Stay = constrainValibot(
  v.object({ guests: toValibot(PositiveInteger), capacity: toValibot(PositiveInteger) }),
  withinCapacity,
);

const Booking = v.object({
  id: toValibot(Uuid),
  email: toValibot(Email),
  backup: v.optional(v.nullable(toValibot(Email))),
  stays: v.array(Stay),
});

const issues = (result: {
  readonly issues?: ReadonlyArray<v.BaseIssue<unknown>> | undefined;
}): unknown =>
  result.issues?.map(({ message, path }) => ({ message, path: path?.map((item) => item.key) }));

describe('toValibot', () => {
  describe.each(sampleTypes)('%o', (target) => {
    const schema = toValibot(target);

    it.each(edgeSamples.map((sample) => [sample]))('agrees with the type on %o', (sample) => {
      expect(v.safeParse(schema, sample).success).toBe(target.parse(sample).ok);
    });
  });

  it('gives instances, and leaves plain fields plain', () => {
    const booking = v.parse(Booking, { id, email: 'a@b.co', stays: [{ guests: 1, capacity: 2 }] });

    expect(booking.id).toBeInstanceOf(Uuid);
    expect(booking.stays[0]?.guests).toBeInstanceOf(PositiveInteger);
    expectTypeOf(booking.email).toEqualTypeOf<Email>();
    expectTypeOf<v.InferInput<typeof Booking>['email']>().toEqualTypeOf<string>();
  });

  it('reports the type messages with their paths', () => {
    expect(
      issues(v.safeParse(Booking, { id: 'x', email: 'nope', backup: 1, stays: [{ guests: 0 }] })),
    ).toStrictEqual([
      { message: 'must be a UUID (was "x")', path: ['id'] },
      { message: 'must be an email address (was a string of 4 characters)', path: ['email'] },
      { message: 'must be a string (was a number)', path: ['backup'] },
      { message: 'must be a positive integer (was 0)', path: ['stays', 0, 'guests'] },
      {
        message: 'Invalid key: Expected "capacity" but received undefined',
        path: ['stays', 0, 'capacity'],
      },
    ]);
  });

  it('writes the paths inside a type that holds an object into its message', () => {
    class Range extends Nominal(
      'valibottest.Range',
      objectOf({ start: PositiveInteger, end: PositiveInteger }),
    ) {}

    expect(
      issues(v.safeParse(v.object({ range: toValibot(Range) }), { range: { start: 0, end: 1 } })),
    ).toStrictEqual([{ message: 'start: must be a positive integer (was 0)', path: ['range'] }]);
  });

  it('takes instances as they are', () => {
    const email = new Email('a@b.co');

    expect(v.parse(toValibot(Email), email)).toBe(email);
  });

  it('is a Standard Schema of its own', () => {
    const schema = toValibot(Email);

    expect(schema['~standard'].vendor).toBe('valibot');
    expect(schema['~standard'].validate('a@b.co')).toStrictEqual({ value: new Email('a@b.co') });
    expect(schema['~standard'].validate('x')).toStrictEqual({
      issues: [{ message: 'must be an email address (was a string of 1 character)' }],
    });
    expect(
      Booking['~standard'].validate({ id, email: 'a@b.co', stays: [{ guests: 1 }] }),
    ).toMatchObject({
      issues: [{ path: [{ key: 'stays' }, { key: 0 }, { key: 'capacity' }] }],
    });
  });

  it('works with a type from another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');

    expect(v.parse(toValibot(copy.Uuid), id)).toBeInstanceOf(copy.Uuid);
  });
});

describe('constrainValibot', () => {
  it('refuses a constraint reading a key an object drops or refuses, not one a loose object keeps', () => {
    const guests = { guests: toValibot(PositiveInteger) };
    const error = new TypeError(
      'constrainValibot: a constraint reads capacity, which the object does not declare',
    );

    expect(() => constrainValibot(v.object(guests), withinCapacity)).toThrow(error);
    expect(() => constrainValibot(v.strictObject(guests), withinCapacity)).toThrow(error);
    expect(() => constrainValibot(v.looseObject(guests), withinCapacity)).not.toThrow();
  });

  it('runs the constraints once the fields are valid, with paths from the top', () => {
    expect(
      issues(
        v.safeParse(v.array(Stay), [
          { guests: 1, capacity: 2 },
          { guests: 3, capacity: 2 },
        ]),
      ),
    ).toStrictEqual([{ message: 'must not exceed the capacity', path: [1, 'guests'] }]);
  });

  it('skips the constraints when a field fails', () => {
    const check = vi.fn<() => boolean>(() => true);
    const Checked = constrainValibot(
      v.object({ guests: toValibot(PositiveInteger) }),
      constraint({ guests: PositiveInteger }, check),
    );

    expect(v.safeParse(Checked, { guests: 0 }).success).toBe(false);
    expect(check).not.toHaveBeenCalled();
  });

  it('adds an issue with no path, and one with a deep path', () => {
    const Never = constrainValibot(
      v.object({ a: toValibot(PositiveInteger) }),
      constraint({ a: PositiveInteger }, () => 'never'),
      constraint({ a: PositiveInteger }, () => false, {
        path: ['a', 'value', 'x'],
        message: 'deep',
      }),
    );

    expect(issues(v.safeParse(Never, { a: 1 }))).toStrictEqual([
      { message: 'never', path: undefined },
      { message: 'deep', path: ['a', 'value', 'x'] },
    ]);
  });
});
