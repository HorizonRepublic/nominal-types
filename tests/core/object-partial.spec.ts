import { describe, expect, expectTypeOf, it } from 'vitest';

import type { PositiveInteger, StandardSchemaV1 } from '../../src/index.ts';
import { AnyString, Email, n, Port } from '../../src/index.ts';
import { callAnyway, disagreements, inputJson, stay, Stay } from '../support/object-fixtures.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const Patch = Stay.partial();

const Config = n.object({ PORT: Port, HOST: AnyString });

describe('ObjectSchema.partial()', () => {
  it('lets every field be missing, and checks the ones present', () => {
    expect(valueOf(Patch.parse({}))).toStrictEqual({});
    expect(valueOf(Patch.parse({ contact: 'jane@example.com' })).contact).toBeInstanceOf(Email);
    expect(issuesOf(Patch.parse({ guests: 0 }))).toStrictEqual([
      { message: 'must be a positive integer (was 0)', path: ['guests'] },
    ]);
  });

  it('counts a field given as undefined as missing, and leaves it out', () => {
    expect(Object.keys(valueOf(Patch.parse({ guests: undefined, capacity: 2 })))).toStrictEqual([
      'capacity',
    ]);
  });

  it('still refuses what is not an object', () => {
    expect(issuesOf(Patch.parse(null))).toStrictEqual([
      { message: 'must be an object (was null)' },
    ]);
    expect(issuesOf(Patch.parse([]))).toStrictEqual([{ message: 'must be an object (was array)' }]);
  });

  it('runs a constraint only when every field it reads is present', () => {
    expect(Patch.parse({ guests: 9 }).ok).toBe(true);
    expect(Patch.parse({ capacity: 1 }).ok).toBe(true);
    expect(issuesOf(Patch.parse({ guests: 9, capacity: 1 }))).toStrictEqual([
      { message: 'must not exceed the capacity', path: ['guests'] },
    ]);
    expect(Patch.parse({ guests: 1, capacity: 1 }).ok).toBe(true);
  });

  it('makes only the fields named optional', () => {
    const Some = Stay.partial('contact');

    expect(Some.parse({ guests: 1, capacity: 1 }).ok).toBe(true);
    expect(issuesOf(Some.parse({ contact: 'jane@example.com' }))).toStrictEqual([
      { message: 'is required', path: ['guests'] },
      { message: 'is required', path: ['capacity'] },
    ]);
  });

  it('keeps strict(), before and after', () => {
    const unknown = [{ message: 'is not allowed', path: ['extra'] }];

    expect(issuesOf(Stay.strict().partial().parse({ extra: 1 }))).toStrictEqual(unknown);
    expect(issuesOf(Stay.partial().strict().parse({ extra: 1 }))).toStrictEqual(unknown);
    expect(Patch.parse({ extra: 1 }).ok).toBe(true);
  });

  it('keeps fromEnv(), before and after', () => {
    expect(valueOf(Config.fromEnv().partial().parse({ PORT: '80' })).PORT).toStrictEqual(
      new Port(80),
    );
    expect(valueOf(Config.partial().fromEnv().parse({ PORT: '80' })).PORT).toStrictEqual(
      new Port(80),
    );
    expect(issuesOf(Config.partial().fromEnv().parse({ PORT: '99999' }))).toStrictEqual([
      { message: 'must be an unsigned 16-bit integer (was a number)', path: ['PORT'] },
    ]);
  });

  it('refuses a name the object does not declare', () => {
    expect(() => callAnyway(Stay, 'partial', 'toString')).toThrow(
      new TypeError('partial(): the object has no field named toString'),
    );
    expect(() => callAnyway(Stay, 'partial', 1)).toThrow(
      new TypeError('partial(): the object has no field named 1'),
    );
  });

  it('agrees with its JSON Schema', () => {
    expect(inputJson(Patch)).toMatchObject({ type: 'object', required: [] });
    expect(
      disagreements(Patch, [
        {},
        { guests: 1 },
        { guests: 0 },
        { contact: 'x' },
        { note: 'a' },
        'x',
        [],
      ]),
    ).toStrictEqual([]);
  });

  it('answers accepts() and writes toPlain() the same way', () => {
    expect(Patch.accepts({})).toBe(true);
    expect(Patch.accepts({ guests: 9, capacity: 1 })).toBe(false);
    expect(Patch.toPlain(valueOf(Patch.parse({ guests: 2 })))).toStrictEqual({ guests: 2 });
  });

  it('types every field as optional, input fields as possibly undefined', () => {
    const Some = Stay.partial('note', 'contact');

    expectTypeOf<StandardSchemaV1.InferOutput<typeof Patch>>().toEqualTypeOf<{
      readonly guests?: PositiveInteger;
      readonly capacity?: PositiveInteger;
      readonly contact?: Email;
      readonly note?: AnyString;
    }>();
    expectTypeOf<StandardSchemaV1.InferOutput<typeof Some>>().toEqualTypeOf<{
      readonly guests: PositiveInteger;
      readonly capacity: PositiveInteger;
      readonly contact?: Email;
      readonly note?: AnyString;
    }>();
    expectTypeOf<{ guests: undefined }>().toExtend<StandardSchemaV1.InferInput<typeof Patch>>();
  });
});

describe('ObjectSchema.required()', () => {
  it('makes every field required, also optional ones', () => {
    const required = [{ message: 'is required', path: ['note'] }];

    expect(issuesOf(Stay.required().parse(stay))).toStrictEqual(required);
    expect(issuesOf(Stay.required().parse({ ...stay, note: undefined }))).toStrictEqual(required);
    expect(Stay.required().parse({ ...stay, note: 'a' }).ok).toBe(true);
  });

  it('makes only the fields named required, and undoes partial()', () => {
    expect(issuesOf(Stay.partial().required('guests').parse({}))).toStrictEqual([
      { message: 'is required', path: ['guests'] },
    ]);
    expect(Stay.required('note').parse({ ...stay, note: 'a' }).ok).toBe(true);
  });

  it('runs constraints again on the fields it made required', () => {
    expect(
      issuesOf(
        Stay.partial()
          .required()
          .parse({ ...stay, guests: 9, note: 'a' }),
      ),
    ).toStrictEqual([{ message: 'must not exceed the capacity', path: ['guests'] }]);
  });

  it('agrees with its JSON Schema', () => {
    const Full = Stay.required();

    expect(inputJson(Full)).toMatchObject({ required: ['guests', 'capacity', 'contact', 'note'] });
    expect(disagreements(Full, [stay, { ...stay, note: 'a' }, {}])).toStrictEqual([]);
  });

  it('types every field as required, with no undefined', () => {
    const Full = Stay.required();

    expectTypeOf<StandardSchemaV1.InferOutput<typeof Full>>().toEqualTypeOf<{
      readonly guests: PositiveInteger;
      readonly capacity: PositiveInteger;
      readonly contact: Email;
      readonly note: AnyString;
    }>();
  });
});
