import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import type { RecordSchema, StandardSchemaV1 } from '../../src/index.ts';
import {
  AnyString,
  CurrencyCode,
  n,
  NonEmptyString,
  Nominal,
  PositiveInteger,
  Uuid,
} from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { satisfiesSchema } from '../support/json-schema.ts';
import { issuesOf, valueOf } from '../support/results.ts';

type Library = typeof library;

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

// A record of more keys than this is built as a dictionary from the start.
const largest = 128;

const keysOf = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `key${String(index)}`);

const inputOf = (
  count: number,
  valueAt: (index: number) => unknown = (index) => index + 1,
): Record<string, unknown> =>
  Object.fromEntries(keysOf(count).map((key, index) => [key, valueAt(index)]));

// A schema of values that gives `undefined` for the text 'none'.
const noneAsUndefined: StandardSchemaV1<unknown, unknown> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) => ({ value: value === 'none' ? undefined : value }),
  },
};

type Records = readonly [
  RecordSchema<unknown, unknown>,
  RecordSchema<unknown, unknown>,
  RecordSchema<unknown, unknown>,
];

const recordsWithoutCode = (): Records => [
  n.record(NonEmptyString, PositiveInteger),
  n.record(n.of(CurrencyCode), PositiveInteger),
  n.record(n.oneOf('EUR', 'USD'), PositiveInteger).partial(),
];

resetConfigurationAfterEach();

describe('a large n.record() value', () => {
  const counts = n.record(NonEmptyString, PositiveInteger);

  it.each([1, largest - 1, largest, largest + 1, 1000])(
    'of %i keys is a plain object with the keys in input order',
    (count) => {
      const input: unknown = JSON.parse(JSON.stringify(inputOf(count)));
      const value = valueOf(counts.parse(input));

      expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
      expect(Object.keys(value)).toStrictEqual(keysOf(count));
      expect(Object.hasOwn(value, 'toString')).toBe(false);
      expect(Reflect.has(value, 'toString')).toBe(true);
      expect(counts.toPlain(value)).toStrictEqual(input);
      expect(Object.getPrototypeOf(counts.toPlain(value))).toBe(Object.prototype);
      expect(counts.stringify(value)).toBe(JSON.stringify(input));
    },
  );

  it.each([largest, largest + 1])(
    'of %i keys keeps integer-like keys first, as JSON does',
    (count) => {
      const input = { ...inputOf(count - 2), 10: 1, 2: 2 };
      const value = valueOf(counts.parse(input));

      expect(Object.keys(value)).toStrictEqual(Object.keys(input));
      expect(counts.stringify(value)).toBe(JSON.stringify(input));
    },
  );

  it.each([3, largest + 1])('of %i keys leaves the symbol keys of the input out', (count) => {
    const input = { ...inputOf(count), [Symbol('hidden')]: 1 };
    const value = valueOf(counts.parse(input));

    expect(Object.getOwnPropertySymbols(value)).toStrictEqual([]);
    expect(Object.keys(value)).toHaveLength(count);
  });

  it.each([3, largest + 1])('of %i keys reads a getter of the input once', (count) => {
    const input: Record<string, unknown> = inputOf(count - 1);
    const read = vi.fn<() => number>(() => 7);

    Object.defineProperty(input, 'counted', { get: read, enumerable: true });

    expect(counts.toPlain(valueOf(counts.parse(input)))).toMatchObject({ counted: 7 });
    expect(read).toHaveBeenCalledOnce();
  });

  it.each([3, largest + 1])('of %i keys refuses a __proto__ key', (count) => {
    const input: unknown = JSON.parse(
      JSON.stringify(inputOf(count - 1)).replace('{', '{"__proto__": {"polluted": true},'),
    );

    expect(issuesOf(counts.parse(input))).toStrictEqual([
      { message: 'is not allowed', path: ['__proto__'] },
    ]);
    expect(counts.accepts(input)).toBe(false);
  });

  it.each([3, largest + 1])('of %i keys refuses a key trimmed into __proto__', (count) => {
    configured({ normalize: { trimStrings: true } }, () => {
      const trimmed = n.record(NonEmptyString, n.object({ polluted: AnyString }));
      const input = {
        ...inputOf(count - 1, () => ({ polluted: 'no' })),
        ' __proto__': { polluted: 'yes' },
      };
      const parsed = trimmed.parse(input);

      expect(issuesOf(parsed)).toStrictEqual([{ message: 'is not allowed', path: [' __proto__'] }]);
      expect(trimmed.accepts(input)).toBe(false);
    });
  });

  it.each([3, largest + 1])('of %i keys trims keys and refuses one that repeats', (count) => {
    configured({ normalize: { trimStrings: true } }, () => {
      const trimmed = n.record(NonEmptyString, PositiveInteger);
      const input = { ' first ': 1, ...inputOf(count - 1) };
      const value = valueOf(trimmed.parse(input));

      expect(Object.keys(value)).toStrictEqual(['first', ...keysOf(count - 1)]);
      expect(issuesOf(trimmed.parse({ ...input, ' key0': 2 }))).toStrictEqual([
        { message: 'must not repeat a key', path: [' key0'] },
      ]);
    });
  });

  it.each([3, largest + 1])(
    'of %i keys keeps a key whose value becomes undefined, and leaves out one given as undefined',
    (count) => {
      const loose = n.record(NonEmptyString, noneAsUndefined).partial();
      const input = { ...inputOf(count - 2, () => 'x'), gone: undefined, none: 'none' };
      const value = valueOf(loose.parse(input));

      expect(Object.hasOwn(value, 'gone')).toBe(false);
      expect(Object.hasOwn(value, 'none')).toBe(true);
      expect(value['none']).toBeUndefined();
      expect(Object.keys(value)).toHaveLength(count - 1);
    },
  );

  it('defines a __proto__ key in a large copy, so the copy keeps its prototype', () => {
    const loose = n.record(NonEmptyString, noneAsUndefined);
    const hand: Record<string, unknown> = inputOf(largest);

    Object.defineProperty(hand, '__proto__', { value: 5, enumerable: true });

    const plain = loose.toPlain(hand);

    expect(Object.getPrototypeOf(plain)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(plain, '__proto__')?.value).toBe(5);
  });
});

describe('a key of n.of(Type)', () => {
  it('is checked by the rules of the type, without making an instance', () => {
    const made = vi.fn<() => void>();

    class Code extends Nominal('test.RecordKeyCode', /^[a-z]{2}$/u) {
      public constructor(value: string) {
        super(value);
        made();
      }
    }

    const byCode = n.record(n.of(Code), PositiveInteger);

    expect(byCode.toPlain(valueOf(byCode.parse({ ab: 1, cd: 2 })))).toStrictEqual({ ab: 1, cd: 2 });
    expect(made).not.toHaveBeenCalled();
    expect(issuesOf(byCode.parse({ abc: 1 }))).toStrictEqual(
      issuesOf(n.record(Code, PositiveInteger).parse({ abc: 1 })),
    );
  });

  it('accepts the keys the type and its JSON Schema accept', () => {
    const byId = n.record(n.of(Uuid), PositiveInteger);
    const names = byId['~standard'].jsonSchema.input({ target: 'draft-2020-12' })['propertyNames'];
    const keys = [
      '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
      '0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F',
      '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5',
      '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f0',
      '',
    ];

    for (const key of keys) {
      const parsed = byId.parse({ [key]: 1 });

      expect(parsed.ok).toBe(n.record(Uuid, PositiveInteger).parse({ [key]: 1 }).ok);
      expect(parsed.ok).toBe(satisfiesSchema(names, key));
    }
  });

  it('keeps the keys open for a type of listed strings', () => {
    class Size extends Nominal('test.RecordKeySize', n.oneOf('s', 'm')) {}

    expect(n.record(n.of(Size), PositiveInteger).keys).toBeUndefined();
  });

  it('takes a type built by another copy of the package', async () => {
    const copy = await anotherCopy();
    const byCode = n.record(n.of(copy.CurrencyCode), copy.PositiveInteger);

    expect(valueOf(byCode.parse({ EUR: 1 }))).toMatchObject({ EUR: { value: 1 } });
    expect(issuesOf(byCode.parse({ euro: 1 }))).toHaveLength(1);
    expect(byCode.stringify(valueOf(byCode.parse({ EUR: 1 })))).toBe('{"EUR":1}');
  });
});

describe('the keys n.record() writes with stringify()', () => {
  const tricky = [
    'a"b',
    'a\\b',
    '\n',
    '\u001F',
    ' ',
    '\u007F',
    'é',
    '퟿',
    '\uD800',
    '􏿿',
    '\uDFFF',
    '',
    '😀',
    '',
  ];

  it.each([
    ['a type that needs no escaping', n.record(CurrencyCode, PositiveInteger)],
    ['n.of() of such a type', n.record(n.of(CurrencyCode), PositiveInteger)],
    ['listed keys', n.record(n.oneOf('EUR', 'USD'), PositiveInteger).partial()],
    ['any text', n.record(AnyString, PositiveInteger)],
  ])('escapes a key of %s that does not come from parse()', (_, record) => {
    const value = valueOf(record.parse({ EUR: 1 }));
    const hand = { ...value, ...Object.fromEntries(tricky.map((key) => [key, value['EUR']])) };
    const text = record.stringify(hand);

    expect(text).toBe(JSON.stringify(record.toPlain(hand)));
    expect(JSON.stringify(JSON.parse(text))).toBe(text);
  });

  it('writes listed and checked keys as they are', () => {
    const listed = n.record(n.oneOf('EUR', 'a"b'), PositiveInteger);
    const value = valueOf(listed.parse({ 'a"b': 2, EUR: 1 }));

    expect(listed.stringify(value)).toBe('{"a\\"b":2,"EUR":1}');
  });
});

describe('n.record() paths without generated code', () => {
  const inputs: unknown[] = [
    inputOf(largest + 1),
    { ...inputOf(largest + 1), bad: 0 },
    { ...inputOf(largest), '': 1 },
    { EUR: 1, USD: 2 },
    { EUR: 1, euro: 2 },
    JSON.parse('{"__proto__": 1, "EUR": 1}'),
  ];

  it.each(inputs)('checks and accepts input %# as the generated code does', (input) => {
    const generated = recordsWithoutCode();
    const plain = configured({ codegen: 'off' }, recordsWithoutCode);

    for (const [index, schema] of plain.entries()) {
      expect(schema.parse(input)).toStrictEqual(generated[index]?.parse(input));
      expect(schema.accepts(input)).toBe(generated[index]?.accepts(input));
    }
  });

  it.each<[0 | 1 | 2, Record<string, unknown>]>([
    [0, inputOf(largest + 1)],
    [1, { EUR: 1, USD: 2 }],
    [2, { USD: 2 }],
  ])('writes the value of record %i as the generated code does', (index, input) => {
    const generated = recordsWithoutCode()[index];
    const plain = configured({ codegen: 'off' }, recordsWithoutCode)[index];
    const value = valueOf(generated.parse(input));

    expect(plain.stringify(value)).toBe(generated.stringify(value));
    expect(plain.stringify(value)).toBe(JSON.stringify(input));
    expect(plain.toPlain(value)).toStrictEqual(generated.toPlain(value));
  });
});
