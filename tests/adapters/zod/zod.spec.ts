import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';

import { constrainZod, toZod } from '../../../src/adapters/zod/index.ts';
import type * as library from '../../../src/index.ts';
import {
  constraint,
  Email,
  Nominal,
  objectOf,
  PositiveInteger,
  satisfying,
  Uuid,
} from '../../../src/index.ts';
import { edgeSamples, sampleTypes } from '../../support/samples.ts';

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

const Stay = constrainZod(
  z.object({ guests: toZod(PositiveInteger), capacity: toZod(PositiveInteger) }),
  withinCapacity,
);

const Booking = z.object({
  id: toZod(Uuid),
  email: toZod(Email),
  backup: toZod(Email).nullable().optional(),
  stays: z.array(Stay),
});

const issues = (result: { readonly error?: z.ZodError | undefined }): unknown =>
  result.error?.issues.map(({ message, path }) => ({ message, path }));

describe('toZod', () => {
  describe.each(sampleTypes)('%o', (target) => {
    const schema = toZod(target);

    it.each(edgeSamples.map((sample) => [sample]))('agrees with the type on %o', (sample) => {
      expect(schema.safeParse(sample).success).toBe(target.parse(sample).ok);
    });
  });

  it('gives instances, and leaves plain fields plain', () => {
    const booking = Booking.parse({ id, email: 'a@b.co', stays: [{ guests: 1, capacity: 2 }] });

    expect(booking.id).toBeInstanceOf(Uuid);
    expect(booking.stays[0]?.guests).toBeInstanceOf(PositiveInteger);
    expectTypeOf(booking.email).toEqualTypeOf<Email>();
    expectTypeOf<z.input<typeof Booking>['email']>().toEqualTypeOf<string>();
  });

  it('reports the type messages with their paths', () => {
    expect(
      issues(Booking.safeParse({ id: 'x', email: 'nope', backup: 1, stays: [{ guests: 0 }] })),
    ).toStrictEqual([
      { message: 'must be a UUID (was "x")', path: ['id'] },
      { message: 'must be an email address (was "nope")', path: ['email'] },
      { message: 'must be a string (was 1)', path: ['backup'] },
      { message: 'must be a positive integer (was 0)', path: ['stays', 0, 'guests'] },
      { message: 'must be a number (was undefined)', path: ['stays', 0, 'capacity'] },
    ]);
  });

  it('keeps the paths inside a type that holds an object', () => {
    class Range extends Nominal(
      'zodtest.Range',
      objectOf({ start: PositiveInteger, end: PositiveInteger }),
    ) {}

    expect(
      issues(z.object({ range: toZod(Range) }).safeParse({ range: { start: 0, end: 1 } })),
    ).toStrictEqual([{ message: 'must be a positive integer (was 0)', path: ['range', 'start'] }]);
  });

  it('takes instances as they are', () => {
    const email = new Email('a@b.co');

    expect(toZod(Email).parse(email)).toBe(email);
  });

  it('describes the input side with the type schema', () => {
    expect(z.toJSONSchema(z.object({ id: toZod(Uuid) }), { io: 'input' })).toMatchObject({
      properties: { id: { title: 'nominal.Uuid', format: 'uuid', minLength: 36 } },
    });
  });

  it('leaves out the schema of a type that has none', () => {
    const Even = Nominal(
      'zodtest.Even',
      satisfying((value: unknown): value is number => value === 2, 'two'),
    );

    expect(z.toJSONSchema(toZod(Even), { io: 'input' })).not.toHaveProperty('title');
  });

  it('works with a type from another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');

    expect(toZod(copy.Uuid).parse(id)).toBeInstanceOf(copy.Uuid);
  });
});

describe('constrainZod', () => {
  it('runs the constraints once the fields are valid, with paths from the top', () => {
    expect(
      issues(
        z.array(Stay).safeParse([
          { guests: 1, capacity: 2 },
          { guests: 3, capacity: 2 },
        ]),
      ),
    ).toStrictEqual([{ message: 'must not exceed the capacity', path: [1, 'guests'] }]);
  });

  it('skips the constraints when a field fails', () => {
    const check = vi.fn<() => boolean>(() => true);
    const Checked = constrainZod(
      z.object({ guests: toZod(PositiveInteger) }),
      constraint({ guests: PositiveInteger }, check),
    );

    expect(Checked.safeParse({ guests: 0 }).success).toBe(false);
    expect(check).not.toHaveBeenCalled();
  });

  it('adds an issue with no path to the object', () => {
    const Never = constrainZod(
      z.object({ a: toZod(PositiveInteger) }),
      constraint({ a: PositiveInteger }, () => 'never'),
    );

    expect(issues(Never.safeParse({ a: 1 }))).toStrictEqual([{ message: 'never', path: [] }]);
  });
});
