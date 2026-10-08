import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';

import * as library from '../../src/index.ts';
import type { AnyNominalType, StandardJSONSchemaV1 } from '../../src/index.ts';
import { Email, n, NonBlankString, PositiveInteger, Uuid } from '../../src/index.ts';
import * as temporal from '../../src/temporal/index.ts';
import { Payment, Stay } from '../support/object-fixtures.ts';

const targets = ['draft-2020-12', 'draft-07', 'openapi-3.0'] as const;

type Describable = StandardJSONSchemaV1;

const describedBy = (schema: Describable): Record<string, unknown> =>
  Object.fromEntries(
    targets.flatMap((target) =>
      (['input', 'output'] as const).map((side): [string, unknown] => {
        try {
          return [`${side} ${target}`, schema['~standard'].jsonSchema[side]({ target })];
        } catch (error) {
          return [`${side} ${target}`, `throws ${String(error)}`];
        }
      }),
    ),
  );

const builtInTypes: Array<readonly [string, AnyNominalType]> = Object.entries<unknown>({
  ...library,
  ...temporal,
})
  .flatMap(([name, value]) => (n.isType(value) ? [[name, value] as const] : []))
  .toSorted(([left], [right]) => left.localeCompare(right));

const schemas: ReadonlyArray<readonly [string, Describable]> = [
  [
    'n.object',
    n.object({
      id: Uuid,
      email: Email,
      age: n.of(PositiveInteger).optional(),
      note: n.of(Email).nullable(),
    }),
  ],
  ['n.object array', n.object({ tags: n.of(NonBlankString).array() })],
  ['n.union', Payment],
  ['n.object with a constraint', Stay],
  ['n.oneOf', n.oneOf('a', 'b', 1)],
  ['n.matching', n.matching(/^[A-Z]{3}$/u, 'a code', { examples: ['ABC', 'abc'] })],
  ['n.of array', n.of(PositiveInteger).array()],
];

describe('JSON Schema of every built-in', () => {
  it('finds the built-in types', () => {
    expect(builtInTypes.length).toBeGreaterThan(50);
  });

  it.each(builtInTypes)('%s stays as it is', (_name, type) => {
    expect(describedBy(type)).toMatchSnapshot('JSON Schema');
  });

  it.each(schemas)('%s stays as it is', (_name, schema) => {
    expect(describedBy(schema)).toMatchSnapshot('JSON Schema');
  });
});
