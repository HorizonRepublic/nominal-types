import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import type { ArrayOptions } from '../../src/index.ts';
import {
  AnyNumber,
  AnyString,
  Email,
  Nominal,
  objectOf,
  PositiveInteger,
  schemaOf,
  Uuid,
} from '../../src/index.ts';
import { satisfiesSchema } from '../support/json-schema.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const first = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';
const second = '6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718';
const uuids = schemaOf(Uuid).array({ unique: true });

// Compares the digits as written, case included.
class ExactUuid extends Uuid {
  public override equals(other: unknown): boolean {
    return other instanceof Uuid && other.value === this.value;
  }
}

type Library = typeof library;

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

describe('array({ unique: true })', () => {
  it('accepts items that are all different', () => {
    expect(valueOf(uuids.parse([first, second]))).toHaveLength(2);
    expect(valueOf(uuids.parse([]))).toStrictEqual([]);
    expect(valueOf(uuids.parse([first]))).toHaveLength(1);
  });

  it('reports every repeat with its index, and not the first time a value appears', () => {
    expect(issuesOf(uuids.parse([first, second, first, first]))).toStrictEqual([
      { message: `must not repeat an item (was "${first}")`, path: [2] },
      { message: `must not repeat an item (was "${first}")`, path: [3] },
    ]);
  });

  it('compares items as equals() does, so a UUID repeats in another case', () => {
    expect(issuesOf(uuids.parse([first, first.toUpperCase()]))).toStrictEqual([
      { message: `must not repeat an item (was "${first.toUpperCase()}")`, path: [1] },
    ]);
  });

  it('keeps two siblings with one value apart, as equals() does', () => {
    class UserId extends Uuid.subtype('UniqueUserId') {}
    class OrderId extends Uuid.subtype('UniqueOrderId') {}

    expect(uuids.parse([new UserId(first), new OrderId(first)]).ok).toBe(true);
    expect(uuids.parse([new UserId(first), new Uuid(first)]).ok).toBe(false);
  });

  it('tells apart several siblings with one value, and still finds a repeat among them', () => {
    class UserId extends Uuid.subtype('UniqueBucketUserId') {}
    class OrderId extends Uuid.subtype('UniqueBucketOrderId') {}
    class CartId extends Uuid.subtype('UniqueBucketCartId') {}

    expect(
      issuesOf(
        uuids.parse([new UserId(first), new OrderId(first), new CartId(first), new OrderId(first)]),
      ),
    ).toStrictEqual([{ message: `must not repeat an item (was "${first}")`, path: [3] }]);
  });

  it.each([
    ['before', [new ExactUuid(first), first]],
    ['after', [first, new ExactUuid(first)]],
  ])('compares an item without a key with the items %s it', (_, input) => {
    expect(issuesOf(uuids.parse(input))).toStrictEqual([
      { message: `must not repeat an item (was "${first}")`, path: [1] },
    ]);
    expect(uuids.parse([new ExactUuid(first), second]).ok).toBe(true);
  });

  it('follows a class that overrides equals() itself', () => {
    const exact = schemaOf(ExactUuid).array({ unique: true });

    expect(exact.parse([first, first.toUpperCase()]).ok).toBe(true);
    expect(exact.parse([first, second, first]).ok).toBe(false);
  });

  it.each([
    ['numbers', schemaOf(PositiveInteger), [1, 2, 1], 'must not repeat an item (was 1)'],
    [
      'NaN (class-validator #2690)',
      schemaOf(AnyNumber),
      [Number.NaN, Number.NaN],
      'must not repeat an item (was NaN)',
    ],
    [
      'undefined',
      schemaOf(AnyString).optional(),
      [undefined, 'a', undefined],
      'must not repeat an item (was undefined)',
    ],
    [
      'null',
      schemaOf(AnyString).nullable(),
      [null, 'a', null],
      'must not repeat an item (was null)',
    ],
    ['strings', schemaOf(AnyString), ['a', 'b', 'a'], 'must not repeat an item (was "a")'],
  ])('finds repeated %s', (_, schema, input, message) => {
    expect(issuesOf(schema.array({ unique: true }).parse(input))).toStrictEqual([
      { message, path: [input.length - 1] },
    ]);
  });

  it('keeps 0 and -0 apart, as equals() does', () => {
    expect(schemaOf(AnyNumber).array({ unique: true }).parse([0, -0]).ok).toBe(true);
  });

  it('compares objects field by field', () => {
    const Line = objectOf({ sku: AnyString, quantity: PositiveInteger });
    const lines = Line.array({ unique: true });

    expect(
      issuesOf(
        lines.parse([
          { sku: 'A', quantity: 1 },
          { sku: 'A', quantity: 2 },
          { quantity: 1, sku: 'A' },
        ]),
      ),
    ).toStrictEqual([{ message: 'must not repeat an item (was object)', path: [2] }]);
  });

  it('compares nested arrays item by item', () => {
    const pairs = schemaOf(Uuid).array().array({ unique: true });

    expect(
      pairs.parse([
        [first, second],
        [second, first],
      ]).ok,
    ).toBe(true);
    expect(issuesOf(pairs.parse([[first], [first.toUpperCase()]]))).toStrictEqual([
      { message: 'must not repeat an item (was array)', path: [1] },
    ]);
  });

  it('leaves the value out for a sensitive type', () => {
    expect(
      issuesOf(
        schemaOf(Email).array({ unique: true }).parse(['jane@example.com', 'jane@example.com']),
      ),
    ).toStrictEqual([
      { message: 'must not repeat an item (was a string of 16 characters)', path: [1] },
    ]);
    expect(
      issuesOf(
        schemaOf(Email)
          .optional()
          .array({ unique: true })
          .parse(['jane@example.com', 'jane@example.com']),
      ),
    ).toStrictEqual([
      { message: 'must not repeat an item (was a string of 16 characters)', path: [1] },
    ]);
  });

  it('checks the count first and the items next, and looks for repeats only then', () => {
    const list = schemaOf(Uuid).array({ max: 2, unique: true });

    expect(issuesOf(list.parse([first, first, first]))).toStrictEqual([
      { message: 'must have at most 2 items (was 3)' },
    ]);
    expect(issuesOf(list.parse([first, 'x']))).toStrictEqual([
      { message: 'must be a UUID (was "x")', path: [1] },
    ]);
  });

  it('lets repeats through without it, or with unique: false', () => {
    expect(schemaOf(Uuid).array().parse([first, first]).ok).toBe(true);
    expect(schemaOf(Uuid).array({ unique: false }).parse([first, first]).ok).toBe(true);
  });

  it.each(['yes', 1, null])('refuses unique: %o', (unique) => {
    // A caller without types can pass anything.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const options = { unique } as unknown as ArrayOptions;

    expect(() => schemaOf(Uuid).array(options)).toThrow(
      new TypeError(`array(): unique must be true or false (was ${String(unique)})`),
    );
  });

  it('puts the path of the field and the repeat on an issue inside an object', () => {
    const Team = objectOf({ members: schemaOf(Uuid).array({ unique: true }) });

    expect(issuesOf(Team.parse({ members: [first, first] }))).toStrictEqual([
      { message: `must not repeat an item (was "${first}")`, path: ['members', 1] },
    ]);
  });

  it('works as the rule of a nominal type', () => {
    class Tags extends Nominal('UniqueTags', schemaOf(AnyString).array({ unique: true })) {}

    expect(new Tags(['a', 'b']).value).toHaveLength(2);
    expect(Tags.parse(['a', 'a']).ok).toBe(false);
  });

  it('stays linear for a long list', () => {
    const many = Array.from(
      { length: 20_000 },
      (_, index) => `0190f1c2-3b4a-7c5d-8e9f-${String(index).padStart(12, '0')}`,
    );
    const started = performance.now();

    expect(uuids.parse(many).ok).toBe(true);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('finds repeats among instances of another copy of the package', async () => {
    const copy = await anotherCopy();
    const fromCopy = schemaOf(copy.Uuid).array({ unique: true });

    expect(issuesOf(fromCopy.parse([first, first.toUpperCase()]))).toStrictEqual([
      { message: 'must not repeat an item (was a string of 36 characters)', path: [1] },
    ]);
    expect(uuids.parse([new copy.Uuid(first), first]).ok).toBe(false);
    expect(copy.schemaOf(Uuid).array({ unique: true }).parse([first, second]).ok).toBe(true);
  });

  it('describes itself with uniqueItems', () => {
    expect(uuids['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      type: 'array',
      uniqueItems: true,
    });
    expect(uuids['~standard'].jsonSchema.output({ target: 'openapi-3.0' })).toMatchObject({
      uniqueItems: true,
    });
    expect(
      schemaOf(Uuid).array()['~standard'].jsonSchema.input({ target: 'draft-07' }),
    ).not.toHaveProperty('uniqueItems');
  });

  it.each([[[first, second]], [[first, first]], [[first, second, first]], [[]], [['a', 'a']]])(
    'agrees with its JSON Schema on %o',
    (input) => {
      for (const target of ['draft-2020-12', 'draft-07', 'openapi-3.0']) {
        expect(satisfiesSchema(uuids['~standard'].jsonSchema.input({ target }), input)).toBe(
          uuids.parse(input).ok,
        );
      }
    },
  );

  it('refuses more than its JSON Schema where equals() ignores case', () => {
    const input = [first, first.toUpperCase()];

    expect(
      satisfiesSchema(uuids['~standard'].jsonSchema.input({ target: 'draft-07' }), input),
    ).toBe(true);
    expect(uuids.parse(input).ok).toBe(false);
  });

  it('keeps the type of the array', () => {
    expectTypeOf(valueOf(uuids.parse([first]))).toEqualTypeOf<readonly Uuid[]>();
  });
});
