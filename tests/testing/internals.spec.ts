import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { AnyNumber, Email, Integer, n, Port, Uuid } from '../../src/index.ts';
import { bounded } from '../../src/testing/bounded.ts';
import { builtInArbitrary } from '../../src/testing/built-ins.ts';
import { characters } from '../../src/testing/characters.ts';
import { sampleOf } from '../../src/testing/index.ts';
import { arbitraryFromJson, matchingPattern } from '../../src/testing/json-arbitrary.ts';
import { describeSchema } from '../../src/testing/schema-arbitrary.ts';
import { satisfiesSchema } from '../support/json-schema.ts';

const schemas: ReadonlyArray<readonly [string, Readonly<Record<string, unknown>>]> = [
  ['a string with lengths', { type: 'string', minLength: 2, maxLength: 5 }],
  ['a string without bounds', { type: 'string' }],
  ['a pattern with a length', { type: 'string', pattern: '^[a-z]+$', maxLength: 4 }],
  ['a format fast-check knows', { type: 'string', format: 'uuid' }],
  ['an integer between bounds', { type: 'integer', minimum: -3, maximum: 7 }],
  ['an integer without bounds', { type: 'integer' }],
  ['a number with excluded bounds', { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 }],
  ['a number with included bounds', { type: 'number', minimum: -1, maximum: 1 }],
  ['a multiple', { type: 'number', multipleOf: 0.5, minimum: 0, maximum: 10 }],
  ['a boolean', { type: 'boolean' }],
  ['null', { type: 'null' }],
  ['a constant', { const: 'fixed' }],
  ['a list of values', { enum: ['a', 1, true] }],
  ['any of several schemas', { type: 'string', anyOf: [{ pattern: '^a$' }, { pattern: '^b$' }] }],
  ['one of several schemas', { oneOf: [{ type: 'boolean' }, { type: 'string' }] }],
  ['all of several schemas', { allOf: [{ type: 'integer' }, { minimum: 0, maximum: 3 }] }],
  [
    'an array',
    { type: 'array', items: { type: 'integer', minimum: 0, maximum: 9 }, minItems: 1, maxItems: 3 },
  ],
  ['an array of anything', { type: 'array', items: { type: 'boolean' } }],
  [
    'an object',
    {
      type: 'object',
      properties: { id: { type: 'string', format: 'uuid' }, age: { type: 'integer', minimum: 0 } },
      required: ['id'],
    },
  ],
];

const sampled = (arbitrary: fc.Arbitrary<unknown> | undefined, count: number): unknown[] =>
  arbitrary === undefined ? [] : fc.sample(arbitrary, count);

const formats = ['email', 'uri', 'ipv4', 'ipv6', 'hostname', 'date', 'date-time'];

describe('arbitraryFromJson()', () => {
  it.each(schemas)('makes values for %s that the schema allows', (_, schema) => {
    const arbitrary = arbitraryFromJson(schema);

    expect(arbitrary).toBeDefined();
    expect(
      sampled(arbitrary, 200).filter((value) => !satisfiesSchema(schema, value)),
    ).toStrictEqual([]);
  });

  it.each(formats)('makes strings of the format %s', (format) => {
    expect(
      sampled(arbitraryFromJson({ type: 'string', format }), 20).every(
        (value) => typeof value === 'string',
      ),
    ).toBe(true);
  });

  it.each<readonly [string, unknown]>([
    ['no schema', undefined],
    ['an array instead of a schema', []],
    ['an unknown type', { type: 'symbol' }],
    ['a choice with a part it cannot read', { anyOf: [{ type: 'string' }, { type: 'symbol' }] }],
    ['an array of items it cannot read', { type: 'array', items: { type: 'symbol' } }],
    [
      'an object with a field it cannot read',
      { type: 'object', properties: { a: { type: 'symbol' } } },
    ],
    ['a pattern fast-check cannot read', { type: 'string', pattern: '^(?=a)' }],
  ])('makes nothing for %s', (_, schema) => {
    expect(arbitraryFromJson(schema)).toBeUndefined();
  });

  it('reads a pattern as text or as a regular expression', () => {
    expect(sampled(matchingPattern(/^x$/u), 3)).toStrictEqual(['x', 'x', 'x']);
    expect(matchingPattern('(')).toBeUndefined();
  });
});

describe('the generator parts', () => {
  it('shrinks only what it would have made', () => {
    const text = characters('ab', 2, 4);
    const kept = bounded(fc.integer(), (value) => value > 0, 'never');

    expect(text.canShrinkWithoutContext('abab')).toBe(true);
    expect(text.canShrinkWithoutContext('a')).toBe(false);
    expect(text.canShrinkWithoutContext('abc')).toBe(false);
    expect(text.canShrinkWithoutContext(1)).toBe(false);
    expect([...text.shrink('ab', undefined)]).toStrictEqual([]);
    expect([...text.shrink('abab', undefined)].map((value) => value.value)).toStrictEqual([
      'ab',
      'aba',
    ]);
    expect(kept.canShrinkWithoutContext(5)).toBe(true);
    expect(kept.canShrinkWithoutContext(-5)).toBe(false);
  });

  it('describes schemas as code in its messages', () => {
    expect(describeSchema(Email)).toBe('nominal.Email');
    expect(describeSchema(n.of(Uuid).nullable().optional())).toBe(
      'n.of(nominal.Uuid).nullable().optional()',
    );
    expect(describeSchema(n.of(Port).fromString().array())).toBe(
      'n.of(nominal.Port).fromString().array()',
    );
    expect(describeSchema(n.union('kind', { a: n.object({}), b: n.object({}) }))).toBe(
      "n.union('kind', { a, b })",
    );
    expect(describeSchema({})).toBe('a schema');
  });

  it('makes Temporal text alone when the runtime has no Temporal', () => {
    const saved: unknown = Reflect.get(globalThis, 'Temporal');

    Reflect.deleteProperty(globalThis, 'Temporal');

    try {
      const level = { typeName: 'nominal.PlainDate', rule: n.matching(/^\d{4}-\d{2}-\d{2}$/u) };

      expect(sampled(builtInArbitrary(level), 20).every((value) => typeof value === 'string')).toBe(
        true,
      );
    } finally {
      Reflect.set(globalThis, 'Temporal', saved);
    }
  });

  it('knows no generator for a name outside the built-in types', () => {
    expect(builtInArbitrary({ typeName: 'shop.Sku' })).toBeUndefined();
    expect(builtInArbitrary({ typeName: 'nominal.Unknown' })).toBeUndefined();
    expect(builtInArbitrary({})).toBeUndefined();
  });

  it('takes the generator a type accepts most of when none is accepted often', () => {
    class Round extends Integer.subtype(
      'testing.Round',
      n.satisfying((value: unknown): value is number => Number(value) % 20 === 0, 'a round number'),
    ) {}

    expect(sampleOf(Round, 20).every((value) => value % 20 === 0)).toBe(true);
  });

  it('makes values for a type whose JSON Schema states only its bounds', () => {
    class Small extends AnyNumber.subtype(
      'testing.Small',
      n.satisfying((value: unknown): value is number => Math.abs(Number(value)) < 1, 'small', {
        type: 'number',
        exclusiveMinimum: -1,
        exclusiveMaximum: 1,
      }),
    ) {}

    expect(sampleOf(Small, 20).every((value) => Math.abs(value) < 1)).toBe(true);
  });
});
