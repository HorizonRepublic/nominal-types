import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import type { RecordSchema, StandardSchemaV1 } from '../../src/index.ts';
import {
  AnyString,
  CurrencyCode,
  DecimalString,
  Email,
  n,
  NonEmptyString,
  Nominal,
  PositiveInteger,
} from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { satisfiesSchema } from '../support/json-schema.ts';
import { issuesOf, valueOf } from '../support/results.ts';

type Library = typeof library;

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

const prices = n.record(CurrencyCode, DecimalString);
const sizes = n.record(n.oneOf('s', 'm', 'l'), PositiveInteger);
const counts = n.record(NonEmptyString, PositiveInteger);

const recordsWithoutCode = (): ReadonlyArray<RecordSchema<unknown, unknown>> => [
  n.record(NonEmptyString, PositiveInteger).max(2),
  n.record(n.oneOf('s', 'm', 'l'), PositiveInteger),
];

resetConfigurationAfterEach();

describe('the value of n.record()', () => {
  it('is written by toPlain() and stringify() as JSON writes it', () => {
    const texts = n.record(AnyString, AnyString);
    const value = valueOf(prices.parse({ EUR: '12.50' }));
    const tricky = valueOf(texts.parse({ 'a"\\\n': 'x', '': 'y' }));

    expect(prices.toPlain(value)).toStrictEqual({ EUR: '12.50' });
    expect(prices.stringify(value)).toBe('{"EUR":"12.50"}');
    expect(texts.stringify(tricky)).toBe(JSON.stringify(n.plain(tricky)));
    expect(counts.stringify(valueOf(counts.parse({})))).toBe('{}');
  });

  it('is frozen by a nominal type built on it, and compared key by key', () => {
    class Stock extends Nominal('test.RecordStock', counts) {}

    const stock = new Stock({ apples: 3 });

    expect(Object.isFrozen(stock.value)).toBe(true);
    expect(stock.equals(new Stock({ apples: 3 }))).toBe(true);
    expect(stock.equals(new Stock({ apples: 4 }))).toBe(false);
    expect(JSON.stringify(stock)).toBe('{"apples":3}');
    expect(() => new Stock({ apples: 0 })).toThrow('must be a positive integer');
  });

  it('works inside arrays, optional fields and objects', () => {
    const order = n.object({ labels: counts.optional(), lines: counts.array({ max: 2 }) });
    const value = valueOf(order.parse({ lines: [{ a: 1 }, {}] }));

    expect(order.stringify(value)).toBe('{"lines":[{"a":1},{}]}');
    expect(issuesOf(order.parse({ lines: [{ a: 0 }] }))).toStrictEqual([
      { message: 'must be a positive integer (was 0)', path: ['lines', 0, 'a'] },
    ]);
  });
});

describe('the JSON Schema of n.record()', () => {
  it('describes open keys with propertyNames and the values with additionalProperties', () => {
    expect(
      counts.min(1).max(5)['~standard'].jsonSchema.input({ target: 'draft-2020-12' }),
    ).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      propertyNames: { type: 'string', minLength: 1 },
      additionalProperties: { type: 'integer', minimum: 1 },
      minProperties: 1,
      maxProperties: 5,
    });
  });

  it('leaves propertyNames out for OpenAPI 3.0, which has no such keyword', () => {
    const schema = counts['~standard'].jsonSchema.input({ target: 'openapi-3.0' });

    expect(Object.keys(schema)).toStrictEqual(['type', 'additionalProperties']);
  });

  it('describes listed keys as required properties', () => {
    const schema = sizes['~standard'].jsonSchema.output({ target: 'draft-07' });

    expect(schema).toMatchObject({
      type: 'object',
      required: ['s', 'm', 'l'],
      additionalProperties: false,
    });
    expect(JSON.stringify(Reflect.get(schema, 'properties'))).toMatch(/^\{"s":.*,"m":.*,"l":/u);
    expect(sizes.partial()['~standard'].jsonSchema.input({ target: 'draft-07' })).toMatchObject({
      required: [],
    });
  });

  it.each<readonly [string, StandardSchemaV1 & RecordSchema<unknown, unknown>, unknown]>([
    ['too few keys', counts.min(1).max(2), {}],
    ['enough keys', counts.min(1).max(2), { a: 1 }],
    ['too many keys', counts.min(1).max(2), { a: 1, b: 2, c: 3 }],
    ['an empty key', counts, { '': 1 }],
    ['a bad value', counts, { a: 0 }],
    ['a value of another kind', counts, { a: 'x' }],
    ['an array', counts, []],
    ['every listed key', sizes, { s: 1, m: 2, l: 3 }],
    ['a listed key missing', sizes, { s: 1, m: 2 }],
    ['an unlisted key', sizes, { s: 1, m: 2, l: 3, xl: 4 }],
    ['a partial record', sizes.partial(), { m: 2 }],
    ['a currency', prices, { EUR: '1' }],
    ['a bad currency', prices, { euro: '1' }],
  ])('agrees with the record on %s', (_, schema, input) => {
    const json = schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

    expect(satisfiesSchema(json, input)).toBe(schema.parse(input).ok);
  });
});

describe('n.record() with configured messages and codes', () => {
  it('gives each issue its code, and lets a messages map word the new ones', () => {
    configured(
      {
        codes: true,
        messages: { invalid_key: 'bad key', too_many_keys: ({ max }) => `max ${String(max)}` },
      },
      () => {
        expect(issuesOf(sizes.parse({ xl: 1, s: 1, m: 1, l: 1 }))).toStrictEqual([
          { code: 'invalid_key', message: 'bad key', path: ['xl'] },
        ]);
        expect(issuesOf(counts.max(1).parse({ a: 1, b: 1 }))).toStrictEqual([
          { code: 'too_many_keys', message: 'max 1' },
        ]);
        expect(issuesOf(counts.min(1).parse({}))).toStrictEqual([
          { code: 'too_few_keys', message: 'must have at least 1 key (was 0)' },
        ]);
        expect(issuesOf(sizes.parse({ s: 1, m: 1 }))).toStrictEqual([
          { code: 'required', message: 'is required', path: ['l'] },
        ]);
      },
    );
  });

  it('leaves the values out as the values setting asks', () => {
    configured({ values: 'hide' }, () => {
      expect(issuesOf(prices.parse({ euro: 'x' }))).toStrictEqual([
        { message: 'key must be an ISO 4217 currency code', path: ['euro'] },
      ]);
    });
    configured({ codes: true, messages: ({ message }) => message }, () => {
      expect(n.hideValues(issuesOf(prices.parse({ euro: '1' })))).toStrictEqual([
        {
          code: 'invalid_key',
          message: 'key must be an ISO 4217 currency code (was a string of 4 characters)',
          path: ['euro'],
        },
      ]);
    });
  });
});

describe('n.record() without generated code', () => {
  it.each<unknown>([
    {},
    { a: 1 },
    { a: 0, '': 2 },
    { a: undefined },
    JSON.parse('{"__proto__": 1}'),
    [],
    null,
    { a: 1, b: 2, c: 3 },
    { s: 1, m: 2, l: 3 },
  ])('checks and accepts %o as the generated code does', (input) => {
    const generated = recordsWithoutCode();
    const plain = configured({ codegen: 'off' }, recordsWithoutCode);

    for (const [index, schema] of plain.entries()) {
      expect(schema.parse(input)).toStrictEqual(generated[index]?.parse(input));
      expect(schema.accepts(input)).toBe(generated[index]?.accepts(input));
    }
  });

  it('writes the value as the generated code does', () => {
    const [plain] = configured({ codegen: 'off' }, recordsWithoutCode);
    const value = valueOf(counts.parse({ a: 1, b: 2 }));

    expect(plain?.toPlain(value)).toStrictEqual({ a: 1, b: 2 });
    expect(plain?.stringify(value)).toBe('{"a":1,"b":2}');
  });

  it('trims and refuses repeated keys without generated code', () => {
    configured({ codegen: 'off', normalize: { trimStrings: true } }, () => {
      const trimmed = n.record(NonEmptyString, PositiveInteger);

      expect(issuesOf(trimmed.parse({ a: 1, ' a': 2 }))).toStrictEqual([
        { message: 'must not repeat a key', path: [' a'] },
      ]);
      expect(trimmed.accepts({ ' a': 2 })).toBe(true);
      expect(trimmed.accepts({ ' a': 2, a: 1 })).toBe(false);
    });
  });
});

describe('n.record() and another copy of the package', () => {
  it('takes keys and values built by another copy', async () => {
    const copy = await anotherCopy();
    const record = n.record(
      copy.NonEmptyString,
      copy.n.record(copy.n.oneOf('x'), copy.PositiveInteger),
    );

    expect(record.parse({ a: { x: 1 } }).ok).toBe(true);
    expect(issuesOf(record.parse({ a: { y: 1 } }))).toStrictEqual([
      { message: 'key must be "x" (was "y")', path: ['a', 'y'] },
      { message: 'is required', path: ['a', 'x'] },
    ]);
    expect(record.stringify(valueOf(record.parse({ a: { x: 1 } })))).toBe('{"a":{"x":1}}');
  });
});

type OutputOf<Schema extends StandardSchemaV1> = StandardSchemaV1.InferOutput<Schema>;

type InputOf<Schema extends StandardSchemaV1> = StandardSchemaV1.InferInput<Schema>;

describe('the types of n.record()', () => {
  it('types open keys as strings and listed keys as the listed strings', () => {
    const loose = n.record(AnyString, n.of(Email).optional());

    expectTypeOf<OutputOf<typeof counts>>().toEqualTypeOf<
      Readonly<Record<string, PositiveInteger>>
    >();
    expectTypeOf<OutputOf<typeof sizes>>().toEqualTypeOf<{
      readonly s: PositiveInteger;
      readonly m: PositiveInteger;
      readonly l: PositiveInteger;
    }>();
    expectTypeOf<OutputOf<ReturnType<typeof sizes.partial>>>().toEqualTypeOf<{
      readonly s?: PositiveInteger;
      readonly m?: PositiveInteger;
      readonly l?: PositiveInteger;
    }>();
    expectTypeOf<OutputOf<typeof loose>>().toEqualTypeOf<
      Readonly<Partial<Record<string, Email>>>
    >();
    expectTypeOf<InputOf<typeof sizes>>().toEqualTypeOf<{
      readonly s: number | PositiveInteger;
      readonly m: number | PositiveInteger;
      readonly l: number | PositiveInteger;
    }>();
  });
});
