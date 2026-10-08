import 'temporal-polyfill/global';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import * as library from '../../src/index.ts';
import type { AnyNominalType } from '../../src/index.ts';
import * as temporal from '../../src/temporal/index.ts';
import { arbitraryOf, invalidArbitraryOf } from '../../src/testing/index.ts';
import { satisfiesSchema } from '../support/json-schema.ts';

const builtIns: AnyNominalType[] = [...Object.values(library), ...Object.values(temporal)].filter(
  (value) => library.n.isType(value),
);

const cases = builtIns.map((type) => [type.typeName, type] as const);

// The values JSON can carry; bigints and Temporal objects only reach the type in code.
const isJsonValue = (value: unknown): boolean =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

const outsideSchemaOf = (type: AnyNominalType, values: readonly unknown[]): unknown[] => {
  const schema = type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

  return values.filter((value) => isJsonValue(value) && !satisfiesSchema(schema, value));
};

// Text that tells values apart, objects included.
const keyOf = (value: unknown): string =>
  typeof value === 'object' && value !== null && !('toJSON' in value)
    ? JSON.stringify(value)
    : String(value);

// Two booleans are all there are; every other type has hundreds of values or more.
const fewest = (type: AnyNominalType): number => (type === library.AnyBoolean ? 2 : 100);

describe('arbitraryOf() for every built-in type', () => {
  it('covers every built-in type', () => {
    expect(builtIns.length).toBeGreaterThan(60);
  });

  it.each(cases)('makes values %s parses and accepts', (_, type) => {
    fc.assert(
      fc.property(arbitraryOf(type), (value) => {
        expect(type.parse(value).ok).toBe(true);
        expect(type.accepts(value)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it.each(cases)('makes values of %s its JSON Schema allows', (_, type) => {
    expect(outsideSchemaOf(type, fc.sample(arbitraryOf(type), 300))).toStrictEqual([]);
  });

  it.each(cases)('makes instances of %s', (_, type) => {
    fc.assert(
      fc.property(arbitraryOf(type, { as: 'instances' }), (instance) => {
        expect(instance).toBeInstanceOf(type);
        expect(type.parse(instance).ok).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it.each(cases)('makes values %s refuses', (_, type) => {
    fc.assert(
      fc.property(invalidArbitraryOf(type), (value) => {
        expect(type.parse(value).ok).toBe(false);
        expect(type.accepts(value)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // The bound leaves room for a busy machine; on an idle one the slowest type takes under two
  // seconds.
  it.each(cases)(
    'makes 10 000 values of %s in under ten seconds',
    (_, type) => {
      const started = performance.now();
      const values = fc.sample(arbitraryOf(type), 10_000);

      expect(values).toHaveLength(10_000);
      expect(performance.now() - started).toBeLessThan(10_000);
    },
    30_000,
  );

  it.each(cases)('makes varied values of %s, not a few repeated', (_, type) => {
    const values = fc.sample(arbitraryOf(type), { numRuns: 500, seed: 7 });

    expect(new Set(values.map((value) => keyOf(value))).size).toBeGreaterThanOrEqual(fewest(type));
  });
});
