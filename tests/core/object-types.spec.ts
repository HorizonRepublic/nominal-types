import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import { AnyString, n, Nominal, NominalError, PositiveInteger } from '../../src/index.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const withinCapacity = n.constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

class Stay extends Nominal(
  'objects.Stay',
  n.object(
    { guests: PositiveInteger, capacity: PositiveInteger, note: n.of(AnyString).optional() },
    withinCapacity,
  ),
) {
  public get free(): number {
    return this.capacity.value - this.guests.value;
  }
}

describe('a type built on n.object()', () => {
  const stay = new Stay({ guests: 2, capacity: 3 });

  it('reads each field through a getter', () => {
    expect(stay.guests).toBeInstanceOf(PositiveInteger);
    expect(stay.guests.value).toBe(2);
    expect(stay.note).toBeUndefined();
    expect(stay.free).toBe(1);
  });

  it('keeps the fields in value only, frozen', () => {
    expect(Object.keys(stay)).toStrictEqual(['value']);
    expect(Object.isFrozen(stay.value)).toBe(true);
  });

  it('writes JSON and text from its value, and compares by value', () => {
    expect(JSON.stringify(stay)).toBe('{"guests":2,"capacity":3}');
    expect(String(stay)).toBe('{"guests":2,"capacity":3}');
    expect(stay.equals(new Stay({ guests: 2, capacity: 3 }))).toBe(true);
    expect(stay.equals(new Stay({ guests: 1, capacity: 3 }))).toBe(false);
  });

  it('throws a NominalError naming the field that breaks a rule', () => {
    expect(() => new Stay({ guests: 4, capacity: 3 })).toThrow(
      new NominalError('objects.Stay', [
        { message: 'must not exceed the capacity', path: ['guests'] },
      ]),
    );
  });

  it('parses without throwing', () => {
    expect(issuesOf(Stay.parse({ guests: 0, capacity: 3 }))).toStrictEqual([
      { message: 'must be a positive integer (was 0)', path: ['guests'] },
    ]);
    expect(valueOf(Stay.parse(stay))).toBe(stay);
  });

  describe('copyWith()', () => {
    it('returns a new instance of the same class with the fields changed', () => {
      const bigger = stay.copyWith({ guests: 3 });

      expect(bigger).toBeInstanceOf(Stay);
      expect(bigger.guests.value).toBe(3);
      expect(bigger.capacity).toBe(stay.capacity);
      expect(bigger.free).toBe(0);
      expect(stay.guests.value).toBe(2);
    });

    it('takes instances and adds an optional field', () => {
      expect(stay.copyWith({ guests: new PositiveInteger(1), note: 'quiet' }).note?.value).toBe(
        'quiet',
      );
    });

    it('throws like new when the change breaks a rule', () => {
      expect(() => stay.copyWith({ guests: 5 })).toThrow(NominalError);
      expect(() => stay.copyWith({ capacity: 0 })).toThrow(NominalError);
    });

    it('returns the class type', () => {
      expectTypeOf(stay.copyWith({ guests: 3 })).toEqualTypeOf<Stay>();
    });
  });

  it.each(['value', 'equals', 'copyWith', 'toJSON', 'toString', 'constructor'])(
    'refuses a field named %s',
    (key) => {
      expect(() => Nominal(`objects.Bad${key}`, n.object({ [key]: PositiveInteger }))).toThrow(
        new TypeError(
          `a type built on n.object() cannot have a field named ${key}: every instance has a member of that name`,
        ),
      );
    },
  );

  it('keeps getters in a subtype that adds a rule', () => {
    class FullStay extends Stay.subtype(
      'objects.FullStay',
      n.constraint(
        { guests: PositiveInteger, capacity: PositiveInteger },
        ({ guests, capacity }) => guests.value === capacity.value,
      ),
    ) {}

    const full = new FullStay({ guests: 3, capacity: 3 });

    expect(full.guests.value).toBe(3);
    expect(full).toBeInstanceOf(Stay);
    expect(() => new FullStay({ guests: 2, capacity: 3 })).toThrow(NominalError);
  });

  it('gets its getters, copyWith() and field checks from a schema built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../src/index.ts');
    const Room = Nominal(
      'objects.CopiedRoom',
      copy.n.object({ guests: copy.PositiveInteger, capacity: copy.PositiveInteger }),
    );
    const room = new Room({ guests: 2, capacity: 3 });
    const readsBeds = n.constraint({ beds: PositiveInteger }, () => true);
    const readsGuests = n.constraint({ guests: PositiveInteger }, () => true);

    expect(room.guests.value).toBe(2);
    expect(room.copyWith({ guests: 3 }).guests.value).toBe(3);
    expect(() => Room.subtype('objects.CopiedSuite', readsBeds)).toThrow(
      new TypeError('subtype: a constraint reads beds, which the object does not declare'),
    );
    expect(() => Room.subtype('objects.CopiedHall', readsGuests)).not.toThrow();
    expect(() =>
      Nominal('objects.CopiedValue', copy.n.object({ value: copy.PositiveInteger })),
    ).toThrow(TypeError);
  });

  it('describes itself as an object in JSON Schema', () => {
    expect(Stay['~standard'].jsonSchema.output({ target: 'draft-2020-12' })).toMatchObject({
      title: 'objects.Stay',
      type: 'object',
      properties: { guests: { title: 'nominal.PositiveInteger' } },
      required: ['guests', 'capacity'],
      additionalProperties: false,
    });
  });

  it('types its fields', () => {
    expectTypeOf(stay.guests).toEqualTypeOf<PositiveInteger>();
    expectTypeOf(stay.note).toEqualTypeOf<AnyString | undefined>();
  });
});
