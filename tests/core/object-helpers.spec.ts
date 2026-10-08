import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import type { StandardSchemaV1 } from '../../src/index.ts';
import {
  AnyString,
  Email,
  n,
  Nominal,
  NominalError,
  Port,
  PositiveInteger,
} from '../../src/index.ts';
import { callAnyway, disagreements, inputJson, stay, Stay } from '../support/object-fixtures.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const Gift = Stay.extend({ recipient: Email, note: PositiveInteger });

class StayChange extends Nominal('helpers.StayChange', Stay.partial()) {}

describe('ObjectSchema.pick() and omit()', () => {
  it('keep the fields named, or all but them, in declared order', () => {
    expect(Stay.pick('note', 'guests').keys).toStrictEqual(['guests', 'note']);
    expect(Stay.omit('contact').keys).toStrictEqual(['guests', 'capacity', 'note']);
    expect(valueOf(Stay.pick('contact').parse({ ...stay, extra: 1 }))).toStrictEqual({
      contact: new Email('jane@example.com'),
    });
  });

  it('keep a constraint only when every field it reads is kept', () => {
    expect(issuesOf(Stay.omit('contact').parse({ guests: 9, capacity: 1 }))).toStrictEqual([
      { message: 'must not exceed the capacity', path: ['guests'] },
    ]);
    expect(Stay.pick('guests').parse({ guests: 9 }).ok).toBe(true);
    expect(Stay.omit('capacity').parse({ guests: 9, contact: 'jane@example.com' }).ok).toBe(true);
  });

  it('keep strict() and partial()', () => {
    expect(Stay.strict().pick('guests').parse({ guests: 1, capacity: 1 }).ok).toBe(false);
    expect(Stay.partial().omit('note').parse({}).ok).toBe(true);
    expect(Stay.partial('note').pick('note', 'guests').parse({ guests: 1 }).ok).toBe(true);
  });

  it('refuse no names and names the object does not declare', () => {
    expect(() => callAnyway(Stay, 'pick')).toThrow(
      new TypeError('pick(): name at least one field'),
    );
    expect(() => callAnyway(Stay, 'omit')).toThrow(
      new TypeError('omit(): name at least one field'),
    );
    expect(() => callAnyway(Stay, 'pick', 'nope')).toThrow(
      new TypeError('pick(): the object has no field named nope'),
    );
    expect(() => callAnyway(Stay, 'omit', '__proto__')).toThrow(
      new TypeError('omit(): the object has no field named __proto__'),
    );
  });

  it('type the fields they keep, and refuse other names at compile time', () => {
    const Picked = Stay.pick('guests', 'note');
    const Left = Stay.omit('guests', 'capacity', 'note');

    expectTypeOf<StandardSchemaV1.InferOutput<typeof Picked>>().toEqualTypeOf<{
      readonly guests: PositiveInteger;
      readonly note?: AnyString;
    }>();
    expectTypeOf<StandardSchemaV1.InferOutput<typeof Left>>().toEqualTypeOf<{
      readonly contact: Email;
    }>();
    // @ts-expect-error: the object has no field named nope
    expect(() => Stay.pick('nope')).toThrow(TypeError);
  });

  it('agree with their JSON Schema', () => {
    expect(inputJson(Stay.pick('guests'))).toMatchObject({
      properties: { guests: { type: 'integer' } },
      required: ['guests'],
    });
    expect(inputJson(Stay.omit('note'))).toMatchObject({
      required: ['guests', 'capacity', 'contact'],
    });
    expect(inputJson(Stay.omit('note'))).not.toHaveProperty(['properties', 'note']);
    expect(disagreements(Stay.pick('guests'), [{ guests: 1 }, {}, stay])).toStrictEqual([]);
  });
});

describe('ObjectSchema.extend()', () => {
  it('adds fields and replaces those of the same name in place', () => {
    expect(Gift.keys).toStrictEqual(['guests', 'capacity', 'contact', 'note', 'recipient']);
    expect(issuesOf(Gift.parse({ ...stay, recipient: 'x', note: 'a' }))).toStrictEqual([
      { message: 'must be a number (was "a")', path: ['note'] },
      { message: 'must be an email address (was a string of 1 character)', path: ['recipient'] },
    ]);
  });

  it('keeps constraints and strict()', () => {
    expect(
      issuesOf(Gift.parse({ ...stay, guests: 9, recipient: 'jane@example.com', note: 1 })),
    ).toStrictEqual([{ message: 'must not exceed the capacity', path: ['guests'] }]);
    expect(
      Stay.strict()
        .extend({ extra: AnyString })
        .parse({ ...stay, extra: 'a' }).ok,
    ).toBe(true);
    expect(
      Stay.strict()
        .extend({})
        .parse({ ...stay, extra: 'a' }).ok,
    ).toBe(false);
  });

  it('reads the new fields from strings after fromEnv()', () => {
    const Config = n.object({ HOST: AnyString }).fromEnv().extend({ PORT: Port });

    expect(valueOf(Config.parse({ PORT: '80', HOST: 'a' })).PORT).toStrictEqual(new Port(80));
  });

  it('drops partial() of a field it replaces', () => {
    expect(issuesOf(Stay.partial().extend({ guests: PositiveInteger }).parse({}))).toStrictEqual([
      { message: 'is required', path: ['guests'] },
    ]);
  });

  it('refuses a field named __proto__', () => {
    expect(() => Stay.extend(Object.fromEntries([['__proto__', Email]]))).toThrow(
      new TypeError('n.object(): a field cannot be named __proto__'),
    );
  });

  it('types the merged fields', () => {
    expectTypeOf<StandardSchemaV1.InferOutput<typeof Gift>>().toEqualTypeOf<{
      readonly guests: PositiveInteger;
      readonly capacity: PositiveInteger;
      readonly contact: Email;
      readonly note: PositiveInteger;
      readonly recipient: Email;
    }>();
  });

  it('agrees with its JSON Schema', () => {
    expect(
      disagreements(Gift, [
        { ...stay, recipient: 'jane@example.com', note: 1 },
        { ...stay, note: 1 },
        stay,
      ]),
    ).toStrictEqual([]);
  });
});

describe('changed object schemas', () => {
  it('are the rule of a nominal type, with a getter for each field', () => {
    const change = new StayChange({ guests: 2 });

    expect(change.guests?.value).toBe(2);
    expect(change.capacity).toBeUndefined();
    expect(() => new StayChange({ guests: 9, capacity: 1 })).toThrow(NominalError);
    expect(change.copyWith({ capacity: 4 }).capacity?.value).toBe(4);
  });

  it('chain left to right and leave the original as it was', () => {
    const Chained = Stay.omit('contact').partial('note').extend({ code: AnyString }).strict();

    expect(Chained.keys).toStrictEqual(['guests', 'capacity', 'note', 'code']);
    expect(Stay.keys).toStrictEqual(['guests', 'capacity', 'contact', 'note']);
    expect(issuesOf(Stay.parse({}))).toHaveLength(3);
  });

  it('work on a schema from another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../src/index.ts');
    const Other = copy.n.object({ a: copy.Email, b: copy.PositiveInteger });
    const Mixed = n.object({ inner: Other.partial().pick('a') });

    expect(Mixed.parse({ inner: {} }).ok).toBe(true);
    expect(issuesOf(Mixed.parse({ inner: { a: 'x' } }))).toStrictEqual([
      { message: 'must be an email address (was a string of 1 character)', path: ['inner', 'a'] },
    ]);
  });
});
