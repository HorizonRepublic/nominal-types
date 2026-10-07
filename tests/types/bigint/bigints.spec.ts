import { describe, expect, it } from 'vitest';

import {
  AnyBigInt,
  Int64,
  NegativeBigInt,
  NonNegativeBigInt,
  NonPositiveBigInt,
  PositiveBigInt,
  Uint64,
} from '../../../src/index.ts';
import type { AnyNominalType } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, valueOf } from '../../support/results.ts';

const int64Lowest = -(2n ** 63n);
const int64Highest = 2n ** 63n - 1n;
const uint64Highest = 2n ** 64n - 1n;

const values = [
  0n,
  1n,
  -1n,
  42n,
  int64Lowest,
  int64Lowest - 1n,
  int64Highest,
  int64Highest + 1n,
  uint64Highest,
  uint64Highest + 1n,
  10n ** 100n,
  -(10n ** 100n),
];

const shortEnough = (value: bigint): boolean => value.toString().length <= 20;

const expectations: ReadonlyArray<
  readonly [AnyNominalType, (value: bigint) => boolean, ((value: bigint) => boolean)?]
> = [
  [AnyBigInt, () => true],
  [PositiveBigInt, (value) => value > 0n],
  [NegativeBigInt, (value) => value < 0n],
  [NonNegativeBigInt, (value) => value >= 0n],
  [NonPositiveBigInt, (value) => value <= 0n],
  // JSON Schema bounds the length of the string, not the value
  [Int64, (value) => value >= int64Lowest && value <= int64Highest, shortEnough],
  [
    Uint64,
    (value) => value >= 0n && value <= uint64Highest,
    (value) => value >= 0n && shortEnough(value),
  ],
];

describe.each(
  expectations.map(
    ([type, accepts, schemaAccepts = accepts]) =>
      [type.typeName, type, accepts, schemaAccepts] as const,
  ),
)('%s', (_, type, accepts, schemaAccepts) => {
  it.each(values)('answers %s as expected', (value) => {
    expect(type.parse(value).ok).toBe(accepts(value));
  });

  it.each(values)('answers the string of %s the same way', (value) => {
    expect(type.parse(value.toString()).ok).toBe(accepts(value));
  });

  it.each(values.filter((value) => accepts(value)))(
    'turns the string of %s into the bigint',
    (value) => {
      expect(valueOf(type.parse(value.toString())).value).toBe(value);
    },
  );

  it.each(values)('agrees with its JSON Schema on the string of %s', (value) => {
    const schema = type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

    expect(satisfiesSchema(schema, value.toString())).toBe(schemaAccepts(value));
  });

  it('writes a decimal string to JSON', () => {
    const value = values.find((candidate) => accepts(candidate));

    expect(JSON.stringify({ value: valueOf(type.parse(value)) })).toBe(
      `{"value":"${String(value)}"}`,
    );
  });
});

describe('AnyBigInt input', () => {
  it.each([
    '',
    ' 1',
    '1 ',
    '+1',
    '-0',
    '01',
    '1.0',
    '1e3',
    '0x10',
    '0b1',
    '1n',
    '١',
    '-',
    1,
    1.5,
    Number.NaN,
    null,
    undefined,
    true,
    {},
    new Object(1n),
  ])('rejects %s', (input) => {
    expect(issuesOf(AnyBigInt.parse(input))).toHaveLength(1);
  });

  it('takes a string of up to 1000 characters', () => {
    expect(new AnyBigInt('9'.repeat(1000)).value).toBe(10n ** 1000n - 1n);
    expect(new AnyBigInt(`-${'9'.repeat(999)}`).value).toBe(-(10n ** 999n - 1n));
    expect(AnyBigInt.parse('9'.repeat(1001)).ok).toBe(false);
  });

  it('takes a bigint of any size', () => {
    expect(new AnyBigInt(10n ** 5000n).value).toBe(10n ** 5000n);
  });

  it('refuses a huge string before converting it', () => {
    const started = performance.now();

    expect(AnyBigInt.parse('9'.repeat(5_000_000)).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('reports what it got', () => {
    expect(issuesOf(AnyBigInt.parse(1.5))).toStrictEqual([
      { message: 'must be a bigint or an integer string (was 1.5)' },
    ]);
    expect(issuesOf(Int64.parse(2n ** 63n))).toStrictEqual([
      { message: 'must be a signed 64-bit integer (was 9223372036854775808n)' },
    ]);
  });

  it('describes its input and its JSON output as the same string', () => {
    const { input, output } = AnyBigInt['~standard'].jsonSchema;

    expect(output({ target: 'draft-07' })).toStrictEqual(input({ target: 'draft-07' }));
    expect(input({ target: 'openapi-3.0' })).toStrictEqual({
      type: 'string',
      pattern: '^(?:0|-?[1-9]\\d*)$',
      maxLength: 1000,
      description: 'an integer string',
    });
  });

  it('compares by value', () => {
    expect(new AnyBigInt('42').equals(new AnyBigInt(42n))).toBe(true);
  });
});

describe('the bigint hierarchy', () => {
  it.each([
    [PositiveBigInt, 1n],
    [NegativeBigInt, -1n],
    [NonNegativeBigInt, 0n],
    [NonPositiveBigInt, 0n],
    [Int64, 0n],
    [Uint64, 0n],
  ] as const)('%o passes where AnyBigInt is expected, not the other way round', (type, value) => {
    expect(valueOf(type.parse(value))).toBeInstanceOf(AnyBigInt);
    expect(new AnyBigInt(value)).not.toBeInstanceOf(type);
  });

  it('narrows an AnyBigInt through parse', () => {
    expect(valueOf(Int64.parse(new AnyBigInt('42')))).toBeInstanceOf(Int64);
    expect(issuesOf(Uint64.parse(new AnyBigInt(-1n)))).toHaveLength(1);
  });
});
