import { describe, expect, it } from 'vitest';

import { flattened } from '../../src/core/flat-schema.ts';
import {
  AnyString,
  Float32,
  Int32,
  Integer,
  NonBlankString,
  PositiveInteger,
} from '../../src/index.ts';
import type { AnyNominalType } from '../../src/index.ts';
import { satisfiesSchema } from '../support/json-schema.ts';
import { generator } from '../support/random-text.ts';

const schemaOf = (type: AnyNominalType): Record<string, unknown> =>
  type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

class Sku extends AnyString.subtype('flat.Sku', /^[A-Z]{3}-\d{4}$/u) {}
class ToySku extends Sku.subtype('flat.ToySku', /^TOY-/u) {}

describe('a JSON Schema of several rules', () => {
  it('is one schema when the rules fit together', () => {
    expect(PositiveInteger['~standard'].jsonSchema.input({ target: 'draft-07' })).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'nominal.PositiveInteger',
      type: 'integer',
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
      description: 'a positive integer',
    });
  });

  it('keeps the narrowest number format', () => {
    expect(schemaOf(Float32)).toMatchObject({ type: 'number', format: 'float' });
    expect(schemaOf(Int32)).toMatchObject({ type: 'integer', format: 'int32' });
    expect(schemaOf(Integer)).not.toHaveProperty('format');
  });

  it('keeps the pattern and the length limits of string rules together', () => {
    expect(schemaOf(NonBlankString)).toMatchObject({
      type: 'string',
      minLength: 1,
      pattern: NonBlankString.pattern.source,
      description: 'a non-blank string',
    });
  });

  it('keeps an allOf for two different patterns', () => {
    expect(schemaOf(ToySku)).toMatchObject({
      allOf: [
        { type: 'string', pattern: String.raw`^[A-Z]{3}-\d{4}$` },
        { type: 'string', pattern: '^TOY-' },
      ],
    });
  });

  it.each<readonly [Record<string, unknown>, Record<string, unknown>, string]>([
    [{ type: 'string', format: 'ipv4' }, { type: 'string', format: 'ipv6' }, 'two string formats'],
    [{ type: 'number', format: 'float' }, { type: 'integer', format: 'int32' }, 'float and int32'],
    [{ type: 'string' }, { type: 'number' }, 'a string and a number'],
    [{ type: 'number', minimum: 0 }, { type: 'number', nullable: true }, 'nullable'],
    [{ type: 'object' }, { properties: {} }, 'properties'],
    [{ enum: ['a', 'b'] }, { enum: ['b', 'c'] }, 'two lists of values'],
  ])('keeps %o and %o apart: %s', (first, second) => {
    expect(flattened([first, second])).toStrictEqual({ allOf: [first, second] });
  });

  it('keeps only the stricter of an inclusive and an exclusive bound', () => {
    expect(
      flattened([
        { type: 'number', minimum: 0, maximum: 10 },
        { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 20 },
      ]),
    ).toStrictEqual({ type: 'number', exclusiveMinimum: 0, maximum: 10 });
    expect(
      flattened([
        { type: 'number', minimum: 5 },
        { type: 'number', exclusiveMinimum: 1 },
      ]),
    ).toStrictEqual({ type: 'number', minimum: 5 });
  });

  it('keeps the examples of every rule, and the description of the last one', () => {
    expect(
      flattened([
        { type: 'string', minLength: 1, description: 'a name', examples: ['Jane'] },
        { type: 'string', maxLength: 9, description: 'a short name', example: 'Al' },
      ]),
    ).toStrictEqual({
      type: 'string',
      minLength: 1,
      maxLength: 9,
      description: 'a short name',
      examples: ['Jane', 'Al'],
    });
  });

  it('merges into a rule that gives a single example', () => {
    expect(
      flattened([
        { type: 'string', example: 'ab' },
        { type: 'string', minLength: 2 },
      ]),
    ).toStrictEqual({ type: 'string', minLength: 2, examples: ['ab'] });
  });

  it('drops a choice that the other rule already makes', () => {
    expect(
      flattened([
        { type: 'string', anyOf: [{ pattern: '^a' }, { pattern: '^b' }] },
        { type: 'string', pattern: '^a' },
      ]),
    ).toStrictEqual({ type: 'string', pattern: '^a' });
  });

  it('keeps a choice that the other rule leaves open', () => {
    expect(
      flattened([
        { type: 'string', anyOf: [{ pattern: '^a' }, { pattern: '^b' }] },
        { type: 'string', minLength: 2 },
      ]),
    ).toStrictEqual({
      type: 'string',
      anyOf: [{ pattern: '^a' }, { pattern: '^b' }],
      minLength: 2,
    });
  });
});

// One random choice per keyword, `undefined` leaving the keyword out.
const choices: ReadonlyArray<readonly [string, readonly unknown[]]> = [
  ['type', ['number', 'integer', 'string', undefined, undefined]],
  ['format', ['double', 'float', 'int32', 'int64', undefined, undefined, undefined]],
  ['minimum', [-3, -1, 0, 1, 2, 4, undefined, undefined, undefined, undefined]],
  ['exclusiveMinimum', [-3, -1, 0, 1, 2, 4, undefined, undefined, undefined, undefined]],
  ['maximum', [-3, -1, 0, 1, 2, 4, undefined, undefined, undefined, undefined]],
  ['exclusiveMaximum', [-3, -1, 0, 1, 2, 4, undefined, undefined, undefined, undefined]],
  ['minLength', [0, 1, 2, 3, undefined, undefined]],
  ['maxLength', [0, 1, 2, 3, undefined, undefined]],
  ['pattern', ['^a', 'b$', undefined, undefined, undefined, undefined]],
  ['enum', [['ab', 'b', 1, 2.5], ...Array.from({ length: 9 })]],
  [
    'anyOf',
    [[{ type: 'string', pattern: '^a' }, { type: 'integer' }], ...Array.from({ length: 9 })],
  ],
  ['not', [{ pattern: 'bb' }, ...Array.from({ length: 9 })]],
  ['nullable', [true, ...Array.from({ length: 19 })]],
  ['description', ['a rule', undefined]],
];

const randomPart = (next: () => number): Record<string, unknown> =>
  Object.fromEntries(
    choices
      .map(([key, options]) => [key, options[Math.floor(next() * options.length)]] as const)
      .filter(([, value]) => value !== undefined),
  );

const values: readonly unknown[] = [
  -5,
  -3,
  -2,
  -1,
  -0.5,
  0,
  0.5,
  1,
  1.5,
  2,
  2.5,
  3,
  4,
  4.5,
  5,
  '',
  'a',
  'b',
  'ab',
  'ba',
  'abb',
  'aab',
  'abcb',
  'xyz',
  null,
  true,
];

const isMerged = (schema: Record<string, unknown>): boolean => !Object.hasOwn(schema, 'allOf');

describe('merging the schemas of several rules', () => {
  const next = generator(13);
  const chains = Array.from({ length: 5000 }, () =>
    Array.from({ length: 2 + Math.floor(next() * 3) }, () => randomPart(next)),
  );

  it('accepts exactly what the allOf of the parts accepts', () => {
    const differences = chains.flatMap((parts) => {
      const flat = flattened(parts);

      return values
        .filter(
          (value) => satisfiesSchema(flat, value) !== satisfiesSchema({ allOf: parts }, value),
        )
        .map((value) => `${JSON.stringify(parts)} on ${JSON.stringify(value)}`);
    });

    expect(differences).toStrictEqual([]);
  });

  it('merges enough of these chains for the comparison to mean something', () => {
    expect(chains.filter((parts) => isMerged(flattened(parts))).length).toBeGreaterThan(500);
  });
});
