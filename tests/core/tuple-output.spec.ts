import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import type { StandardSchemaV1, TupleSchema } from '../../src/index.ts';
import { AnyString, Latitude, Longitude, n, Nominal, PositiveInteger } from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { satisfiesSchema } from '../support/json-schema.ts';
import { issuesOf, valueOf } from '../support/results.ts';

type Library = typeof library;

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

const point = n.tuple([Latitude, Longitude]);
const command = n.tuple([AnyString], AnyString);
const range = n.tuple([PositiveInteger, n.of(PositiveInteger).optional()]);

const tuplesWithoutCode = (): ReadonlyArray<TupleSchema<unknown, unknown>> => [
  n.tuple([Latitude, Longitude]),
  n.tuple([AnyString], AnyString),
  n.tuple([PositiveInteger, n.of(PositiveInteger).optional()]),
];

resetConfigurationAfterEach();

describe('the value of n.tuple()', () => {
  it('is written by toPlain() and stringify() as JSON writes it', () => {
    const value = valueOf(command.parse(['a"b', 'c\n']));

    expect(command.toPlain(value)).toStrictEqual(['a"b', 'c\n']);
    expect(command.stringify(value)).toBe(JSON.stringify(['a"b', 'c\n']));
    expect(range.stringify(valueOf(range.parse([3])))).toBe('[3]');
    expect(range.stringify(valueOf(range.parse([3, undefined])))).toBe('[3,null]');
  });

  it('is frozen by a nominal type built on it, and compared item by item', () => {
    class Point extends Nominal('test.TuplePoint', point) {}

    const here = new Point([50.45, 30.52]);

    expect(Object.isFrozen(here.value)).toBe(true);
    expect(here.equals(new Point([50.45, 30.52]))).toBe(true);
    expect(here.equals(new Point([50.45, 30.53]))).toBe(false);
    expect(JSON.stringify(here)).toBe('[50.45,30.52]');
  });

  it('works in arrays and optional fields', () => {
    const route = n.object({ start: point.optional(), stops: point.array({ max: 3 }) });
    const value = valueOf(route.parse({ stops: [[1, 2]] }));

    expect(route.stringify(value)).toBe('{"stops":[[1,2]]}');
    expect(issuesOf(route.parse({ stops: [[1, 2], [3]] }))).toStrictEqual([
      { message: 'must have 2 items (was 1)', path: ['stops', 1] },
    ]);
  });
});

describe('the JSON Schema of n.tuple()', () => {
  it('lists the positions as prefixItems in draft 2020-12', () => {
    expect(point['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'array',
      prefixItems: [{ title: 'nominal.Latitude' }, { title: 'nominal.Longitude' }],
      items: false,
      minItems: 2,
      maxItems: 2,
    });
    expect(command['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      prefixItems: [{ type: 'string' }],
      items: { type: 'string' },
      minItems: 1,
    });
  });

  it('lists the positions as an items array in draft-07', () => {
    expect(range['~standard'].jsonSchema.input({ target: 'draft-07' })).toMatchObject({
      type: 'array',
      items: [{ type: 'integer' }, { type: 'integer' }],
      additionalItems: false,
      minItems: 1,
      maxItems: 2,
    });
  });

  it('describes each position as any of the item schemas for OpenAPI 3.0', () => {
    expect(command['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toMatchObject({
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    });
    expect(
      n.tuple([AnyString, PositiveInteger])['~standard'].jsonSchema.input({
        target: 'openapi-3.0',
      }),
    ).toMatchObject({
      items: { anyOf: [{ type: 'string' }, { type: 'integer' }] },
      minItems: 2,
      maxItems: 2,
    });
    expect(n.tuple([])['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toStrictEqual({
      type: 'array',
      items: {},
      maxItems: 0,
    });
  });

  it.each<readonly [string, TupleSchema<unknown, unknown>, unknown]>([
    ['a point', point, [1, 2]],
    ['a short point', point, [1]],
    ['a long point', point, [1, 2, 3]],
    ['a bad latitude', point, [95, 2]],
    ['an object', point, {}],
    ['no words', command, []],
    ['one word', command, ['a']],
    ['several words', command, ['a', 'b', 'c']],
    ['a number in the rest', command, ['a', 1]],
    ['a range without its end', range, [1]],
    ['a range', range, [1, 2]],
    ['a long range', range, [1, 2, 3]],
    ['a bad start', range, [0]],
    ['the empty tuple', n.tuple([]), []],
    ['an item in the empty tuple', n.tuple([]), [1]],
  ])('agrees with the tuple on %s, in both drafts', (_, schema, input) => {
    for (const target of ['draft-2020-12', 'draft-07'] as const) {
      const json = schema['~standard'].jsonSchema.input({ target });

      expect(satisfiesSchema(json, input)).toBe(schema.parse(input).ok);
    }
  });
});

describe('n.tuple() without generated code', () => {
  it.each<unknown>([[], [1], [1, 2], [1, 2, 3], [0, 'x'], ['a', 'b', 1], null, {}])(
    'checks and accepts %o as the generated code does',
    (input) => {
      const generated = tuplesWithoutCode();
      const plain = configured({ codegen: 'off' }, tuplesWithoutCode);

      for (const [index, schema] of plain.entries()) {
        expect(schema.parse(input)).toStrictEqual(generated[index]?.parse(input));
        expect(schema.accepts(input)).toBe(generated[index]?.accepts(input));
      }
    },
  );

  it('writes the value as the generated code does', () => {
    const [, rest, optional] = configured({ codegen: 'off' }, tuplesWithoutCode);
    const words = valueOf(command.parse(['a', 'b']));

    expect(rest?.toPlain(words)).toStrictEqual(['a', 'b']);
    expect(rest?.stringify(words)).toBe('["a","b"]');
    expect(optional?.stringify(valueOf(range.parse([1])))).toBe('[1]');
  });
});

describe('n.tuple() and another copy of the package', () => {
  it('takes items built by another copy', async () => {
    const copy = await anotherCopy();
    const pair = n.tuple([copy.Uuid, copy.n.tuple([copy.PositiveInteger])]);
    const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

    expect(pair.parse([id, [1]]).ok).toBe(true);
    expect(issuesOf(pair.parse([id, [0]]))).toStrictEqual([
      { message: 'must be a positive integer (was 0)', path: [1, 0] },
    ]);
    expect(pair.stringify(valueOf(pair.parse([id, [1]])))).toBe(`["${id}",[1]]`);
  });
});

type OutputOf<Schema extends StandardSchemaV1> = StandardSchemaV1.InferOutput<Schema>;

type InputOf<Schema extends StandardSchemaV1> = StandardSchemaV1.InferInput<Schema>;

describe('the types of n.tuple()', () => {
  it('types each position, optional trailing items and the rest', () => {
    expectTypeOf<OutputOf<typeof point>>().toEqualTypeOf<readonly [Latitude, Longitude]>();
    expectTypeOf<OutputOf<typeof command>>().toEqualTypeOf<readonly [AnyString, ...AnyString[]]>();
    expectTypeOf<OutputOf<typeof range>>().toEqualTypeOf<
      readonly [PositiveInteger, (PositiveInteger | undefined)?]
    >();
    expectTypeOf<InputOf<typeof point>>().toEqualTypeOf<
      readonly [number | Latitude, number | Longitude]
    >();
  });
});
