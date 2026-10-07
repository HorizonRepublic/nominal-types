import { type } from 'arktype';
import { describe, expect, it, vi } from 'vitest';

import { arkOf, arkSchema, arkObject } from '../../../src/adapters/arktype/index.ts';
import { constraint, PositiveInteger } from '../../../src/index.ts';
import { issuesOf, valueOf } from '../../support/results.ts';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

const atMostTen = constraint(
  { capacity: PositiveInteger },
  ({ capacity }) => capacity.value <= 10,
  {
    message: 'must be at most 10 places',
  },
);

const Stay = arkObject(
  type({ guests: arkOf(PositiveInteger), capacity: arkOf(PositiveInteger) }),
  withinCapacity,
);

describe('constraints in arkSchema', () => {
  it('runs a constraint given to arkSchema on the top object', () => {
    const Booking = arkSchema(
      type({ guests: arkOf(PositiveInteger), capacity: arkOf(PositiveInteger) }),
      withinCapacity,
    );

    expect(valueOf(Booking.parse({ guests: 3, capacity: 3 })).guests).toBeInstanceOf(
      PositiveInteger,
    );
    expect(issuesOf(Booking.parse({ guests: 4, capacity: 3 }))).toStrictEqual([
      { message: 'must not exceed the capacity', path: ['guests'] },
    ]);
  });

  it('runs a constraint attached inside, with the path from the top', () => {
    const Booking = arkSchema(type({ stays: Stay.array(), main: Stay }));

    expect(
      issuesOf(
        Booking.parse({
          stays: [
            { guests: 1, capacity: 1 },
            { guests: 5, capacity: 3 },
          ],
          main: { guests: 2, capacity: 1 },
        }),
      ),
    ).toStrictEqual([
      { message: 'must not exceed the capacity', path: ['main', 'guests'] },
      { message: 'must not exceed the capacity', path: ['stays', 1, 'guests'] },
    ]);
  });

  it('runs a constraint inside an optional field only when it is present', () => {
    const Booking = arkSchema(type({ 'extra?': Stay, byRoom: type({ '[string]': Stay }) }));

    expect(Booking.parse({ byRoom: {} }).ok).toBe(true);
    expect(issuesOf(Booking.parse({ extra: { guests: 4, capacity: 1 }, byRoom: {} }))).toHaveLength(
      1,
    );
    expect(
      issuesOf(
        Booking.parse({ byRoom: { a: { guests: 1, capacity: 1 }, b: { guests: 9, capacity: 1 } } }),
      ),
    ).toStrictEqual([{ message: 'must not exceed the capacity', path: ['byRoom', 'b', 'guests'] }]);
  });

  it('runs a constraint inside the matching branch of a union', () => {
    const Booking = arkSchema(
      type({
        room: arkObject(
          type({
            kind: "'room'",
            guests: arkOf(PositiveInteger),
            capacity: arkOf(PositiveInteger),
          }),
          withinCapacity,
        ).or({ kind: "'none'" }),
      }),
    );

    expect(Booking.parse({ room: { kind: 'none' } }).ok).toBe(true);
    expect(
      issuesOf(Booking.parse({ room: { kind: 'room', guests: 4, capacity: 1 } })),
    ).toHaveLength(1);
  });

  it('runs every constraint and adds those attached twice', () => {
    const Twice = arkSchema(arkObject(Stay, atMostTen));

    expect(issuesOf(Twice.parse({ guests: 12, capacity: 11 }))).toStrictEqual([
      { message: 'must not exceed the capacity', path: ['guests'] },
      { message: 'must be at most 10 places' },
    ]);
  });

  it("doesn't run constraints when ArkType rejects the input", () => {
    const check = vi.fn<() => boolean>(() => true);
    const Booking = arkSchema(
      type({ guests: arkOf(PositiveInteger) }),
      constraint({ guests: PositiveInteger }, check),
    );

    expect(issuesOf(Booking.parse({ guests: 0 }))).toHaveLength(1);
    expect(check).not.toHaveBeenCalled();
  });

  it('checks a listed field that ArkType holds as a plain value against its type', () => {
    const Booking = arkSchema(type({ guests: 'number', capacity: 'number' }), withinCapacity);

    expect(issuesOf(Booking.parse({ guests: 0, capacity: 3 }))).toStrictEqual([
      { message: 'must be a positive integer (was 0)', path: ['guests'] },
    ]);
    expect(issuesOf(Booking.parse({ guests: 4, capacity: 3 }))).toStrictEqual([
      { message: 'must not exceed the capacity', path: ['guests'] },
    ]);
  });

  it('refuses to attach constraints to something other than an object', () => {
    expect(() => arkObject(type('string'), withinCapacity)).toThrow(
      new TypeError('arkObject: constraints attach to an ArkType object type'),
    );
  });

  it('keeps the ArkType type usable on its own', () => {
    expect(Stay({ guests: 9, capacity: 1 })).toStrictEqual({ guests: 9, capacity: 1 });
  });
});
