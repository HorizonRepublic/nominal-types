import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  AnyBoolean,
  AnyString,
  Email,
  Int8,
  n,
  NonBlankString,
  Nominal,
  Port,
  PositiveInteger,
  Uuid,
} from '../../src/index.ts';
import type { NominalTarget } from '../../src/index.ts';
import { arbitraryOf, invalidArbitraryOf } from '../../src/testing/index.ts';
import { satisfiesSchema } from '../support/json-schema.ts';

// Calls parse() of a type or of a schema, whose methods TypeScript can't take as one.
const parses = (target: NominalTarget, value: unknown): boolean =>
  n.isType(target) ? target.parse(value).ok : target.parse(value).ok;

const many = (target: NominalTarget, count = 1000): unknown[] =>
  fc.sample(arbitraryOf(target), { numRuns: count, seed: 5 });

const isCarried = (part: unknown, inArray: boolean): boolean => {
  if (part === undefined) {
    return !inArray;
  }

  if (Array.isArray(part)) {
    return part.every((item) => isCarried(item, true));
  }

  if (typeof part === 'object' && part !== null) {
    return Object.values(part).every((item) => isCarried(item, false));
  }

  return typeof part !== 'bigint' && (typeof part !== 'number' || Number.isFinite(part));
};

// The values JSON can carry, as it carries them: a field set to `undefined` is left out, as
// JSON.stringify() leaves it, and an array holding `undefined` is not carried at all.
const jsonFormsOf = (values: readonly unknown[]): unknown[] =>
  values
    .filter((value) => value !== undefined && isCarried(value, false))
    .map((value): unknown => JSON.parse(JSON.stringify(value)));

const outsideSchemaOf = (schema: NominalTarget, values: readonly unknown[]): unknown[] => {
  const json = schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

  return jsonFormsOf(values).filter((value) => !satisfiesSchema(json, value));
};

const fieldsOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : {};

const lengthsOf = (values: readonly unknown[]): Set<number> =>
  new Set(values.map((value) => [value].flat().length));

const CreateOrder = n.object({
  customer: Email,
  lines: n.of(Uuid).array({ min: 1, max: 5 }),
  quantity: PositiveInteger,
  note: n.of(NonBlankString).optional(),
});

const Payment = n.union('method', {
  card: n.object({ token: NonBlankString }),
  invoice: n.object({ email: Email, days: Int8 }),
  cash: n.object({}),
});

const Booking = n.object(
  { from: Int8, to: Int8 },
  n.constraint(
    { from: Int8, to: Int8 },
    ({ from, to }) => from.value <= to.value || 'from must not be after to',
  ),
);

const fromText = n.of(Port).fromString();
const fromEnv = n.object({ PORT: Port, DEBUG: AnyBoolean }).fromEnv();

// Schemas that read text, which their JSON Schema leaves out.
const reads = new Set<NominalTarget>([fromText, fromEnv]);

const schemas: ReadonlyArray<readonly [string, NominalTarget]> = [
  ['an array with counts', n.of(Email).array({ min: 2, max: 4 })],
  ['an array of exact length', n.of(Port).array({ length: 3 })],
  ['an array of unique items', n.of(Int8).array({ unique: true, max: 50 })],
  ['an optional value', n.of(Uuid).optional()],
  ['a nullable array', n.of(Uuid).array().nullable()],
  ['an array of optional values', n.of(Uuid).optional().array()],
  ['values read from text', fromText],
  ['an object', CreateOrder],
  ['a strict object', CreateOrder.strict()],
  ['a partial object', CreateOrder.partial()],
  ['picked fields', CreateOrder.pick('customer', 'note')],
  ['omitted fields', CreateOrder.omit('customer')],
  ['an extended object', CreateOrder.extend({ coupon: n.of(AnyString).nullable() })],
  ['a required object', CreateOrder.partial().required('quantity')],
  ['an object of a constraint', Booking],
  ['an object read from the environment', fromEnv],
  ['a nested object', n.object({ order: CreateOrder, payment: Payment })],
  ['a union', Payment],
  ['an empty strict object', n.object({}).strict()],
  ['an array of unions', Payment.array({ max: 3 })],
];

describe('arbitraryOf() for schemas', () => {
  it.each(schemas)('makes values %s accepts and parses', (_, schema) => {
    fc.assert(
      fc.property(arbitraryOf(schema), (value) => {
        expect(schema.accepts(value)).toBe(true);
        expect(parses(schema, value)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it.each(schemas.filter(([, schema]) => !reads.has(schema)))(
    'makes values of %s its JSON Schema allows',
    (_, schema) => {
      expect(outsideSchemaOf(schema, many(schema, 300))).toStrictEqual([]);
    },
  );

  it.each(schemas)('makes values %s refuses', (_, schema) => {
    fc.assert(
      fc.property(invalidArbitraryOf(schema), (value) => {
        expect(schema.accepts(value)).toBe(false);
        expect(parses(schema, value)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it('makes arrays of the shortest and the longest count allowed', () => {
    expect(lengthsOf(many(n.of(Email).array({ min: 2, max: 4 })))).toStrictEqual(
      new Set([2, 3, 4]),
    );
    expect(lengthsOf(many(n.of(Port).array({ length: 3 })))).toStrictEqual(new Set([3]));
    expect(lengthsOf(many(n.of(Port).array()))).toContain(0);
  });

  it('makes arrays without repeats as equals() compares them', () => {
    const lists = many(n.of(Uuid).array({ unique: true, min: 3 }));

    const repeating = lists.filter(
      (list) =>
        new Set([list].flat().map((item) => String(item).toLowerCase())).size !==
        [list].flat().length,
    );

    expect(repeating).toStrictEqual([]);
  });

  it('fails clearly when unique items cannot fill the array', () => {
    expect(() =>
      fc.sample(arbitraryOf(n.of(AnyBoolean).array({ unique: true, min: 3 })), 1),
    ).toThrow(
      'arbitraryOf(): n.of(nominal.AnyBoolean).array() needs 3 distinct items, and its items come in fewer kinds',
    );
  });

  it('makes undefined for an optional value and null for a nullable one', () => {
    expect(many(n.of(Uuid).optional())).toContain(undefined);
    expect(many(n.of(Uuid).nullable())).toContain(null);
    expect(many(n.of(Uuid).optional()).some((value) => typeof value === 'string')).toBe(true);
  });

  it('makes text for a schema that reads values from text, and the values themselves', () => {
    const values = many(n.of(Port).fromString());

    expect(values.some((value) => typeof value === 'string')).toBe(true);
    expect(values.some((value) => typeof value === 'number')).toBe(true);
  });

  it('makes text for every field of an object read from the environment', () => {
    const values = many(n.object({ PORT: Port, DEBUG: AnyBoolean }).fromEnv());

    expect(values.some((value) => typeof fieldsOf(value)['PORT'] === 'string')).toBe(true);
    expect(values.some((value) => fieldsOf(value)['DEBUG'] === 'true')).toBe(true);
  });

  it('leaves optional fields out sometimes and keeps required ones always', () => {
    const values = many(CreateOrder);

    expect(values.every((value) => Object.hasOwn(fieldsOf(value), 'customer'))).toBe(true);
    expect(values.some((value) => !Object.hasOwn(fieldsOf(value), 'note'))).toBe(true);
    expect(values.some((value) => Object.hasOwn(fieldsOf(value), 'note'))).toBe(true);
  });

  it('makes plain objects with the declared keys only', () => {
    const values = many(CreateOrder.strict());

    expect(values.every((value) => Object.getPrototypeOf(value) === Object.prototype)).toBe(true);
    expect(
      values.every((value) =>
        Object.keys(fieldsOf(value)).every((key) => CreateOrder.keys.includes(key)),
      ),
    ).toBe(true);
  });

  it('leaves out any field of a partial object', () => {
    expect(many(CreateOrder.partial())).toContainEqual({});
  });

  it('makes values that keep the constraint of an object', () => {
    expect(
      many(Booking).filter(
        (value) => Number(fieldsOf(value)['from']) > Number(fieldsOf(value)['to']),
      ),
    ).toStrictEqual([]);
  });

  it('fails clearly when a constraint refuses almost everything', () => {
    const Rare = n.object(
      { code: Uuid },
      n.constraint({ code: Uuid }, ({ code }) => code.value === 'never'),
    );

    expect(() => fc.sample(arbitraryOf(Rare), 1)).toThrow(
      'arbitraryOf(): n.object({ code }) refused 1000 generated values in a row, so its rules or constraints refuse almost everything the generator makes. Pass a generator of your own: { overrides: new Map([[schema, arbitrary]]) }',
    );
  });

  it('makes every variant of a union with its tag first', () => {
    const values = many(Payment);

    expect(new Set(values.map((value) => fieldsOf(value)['method']))).toStrictEqual(
      new Set(['card', 'invoice', 'cash']),
    );
    expect(values.every((value) => Object.keys(fieldsOf(value))[0] === 'method')).toBe(true);
  });

  it('replaces a field the variant declares under the key with the tag', () => {
    const Event = n.union('kind', { opened: n.object({ kind: Uuid, at: Port }) });

    expect(many(Event).every((value) => fieldsOf(value)['kind'] === 'opened')).toBe(true);
  });

  it('makes values for a type declared on a schema, and instances of it', () => {
    class Order extends Nominal('test.Order', CreateOrder) {}

    fc.assert(
      fc.property(arbitraryOf(Order), arbitraryOf(Order, { as: 'instances' }), (value, order) => {
        expect(Order.accepts(value)).toBe(true);
        expect(order).toBeInstanceOf(Order);
      }),
      { numRuns: 100 },
    );
  });

  it('makes the values parse() gives for a schema', () => {
    fc.assert(
      fc.property(arbitraryOf(CreateOrder, { as: 'instances' }), (order) => {
        expect(order.customer).toBeInstanceOf(Email);
        expect(order.lines.every((line) => line instanceof Uuid)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
