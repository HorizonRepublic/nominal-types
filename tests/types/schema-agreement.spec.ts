import { describe, expect, it } from 'vitest';

import * as library from '../../src/index.ts';
import { AnyNumber, Float32, n } from '../../src/index.ts';
import type { AnyNominalType } from '../../src/index.ts';
import { satisfiesSchema } from '../support/json-schema.ts';

const schemaOf = (type: AnyNominalType): Record<string, unknown> =>
  type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

const builtIns = Object.values(library).filter((value) => n.isType(value));

// Numbers around the bounds of the built-in number types, and a little of everything else.
const numbers: readonly number[] = [
  0,
  -0,
  1,
  -1,
  0.5,
  -0.5,
  1.5,
  90,
  90.5,
  -90.5,
  180,
  180.5,
  127,
  128,
  -128,
  -129,
  255,
  256,
  32_767,
  32_768,
  -32_768,
  -32_769,
  65_535,
  65_536,
  2 ** 31 - 1,
  2 ** 31,
  -(2 ** 31) - 1,
  2 ** 32 - 1,
  2 ** 32,
  3.4e38,
  1e39,
  Number.MAX_SAFE_INTEGER,
  Number.MAX_SAFE_INTEGER + 2,
  -Number.MAX_SAFE_INTEGER,
  -Number.MAX_SAFE_INTEGER - 2,
  Number.MAX_VALUE,
  0.1,
];
const texts: readonly string[] = [
  '',
  ' a ',
  '-1',
  '0.0.0',
  'https://a.co',
  'ftp://a.co',
  'localhost',
  '192.0.2.1',
  '::1',
  '192.0.2.0/24',
  'jane@example.com',
];
const samples: readonly unknown[] = [...numbers, ...texts, true, null];

// Number types whose schema says exactly what the type accepts.
const exactNumbers = builtIns
  .filter((type) => type !== Float32 && type !== AnyNumber)
  .filter((type) => ['number', 'integer'].includes(String(schemaOf(type)['type'])));

describe('the JSON Schema of every built-in type', () => {
  it.each(builtIns.map((type) => [type.typeName, type] as const))(
    'refuses no value %s accepts',
    (_, type) => {
      const schema = schemaOf(type);
      const accepted = samples.filter((value) => type.parse(value).ok);

      expect(accepted.filter((value) => !satisfiesSchema(schema, value))).toStrictEqual([]);
    },
  );

  it('covers the number types in one schema each', () => {
    expect(exactNumbers.length).toBeGreaterThan(15);
  });

  it.each(exactNumbers.map((type) => [type.typeName, type] as const))(
    'accepts exactly the numbers %s accepts',
    (_, type) => {
      const schema = schemaOf(type);

      expect(
        numbers.filter((value) => type.parse(value).ok !== satisfiesSchema(schema, value)),
      ).toStrictEqual([]);
    },
  );
});
