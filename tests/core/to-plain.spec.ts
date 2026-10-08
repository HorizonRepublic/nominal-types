import 'temporal-polyfill/global';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';

import { instanceWriter, arrayWriter, objectWriter } from '../../src/core/plain-writers.ts';
import type { Write } from '../../src/core/plain-writers.ts';
import type * as library from '../../src/index.ts';
import {
  AnyBoolean,
  AnyString,
  Email,
  Int64,
  n,
  Nominal,
  PositiveInteger,
  Uuid,
} from '../../src/index.ts';
import { Instant } from '../../src/temporal/index.ts';
import { valueOf } from '../support/results.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

// toPlain() given a value its type doesn't allow, as plain JavaScript can.
const toPlainOfAny = (schema: object, value: unknown): unknown => {
  const toPlain: unknown = Reflect.get(schema, 'toPlain');

  return typeof toPlain === 'function' ? Reflect.apply(toPlain, schema, [value]) : undefined;
};

class Stay extends Nominal('toPlain.Stay', n.object({ guests: PositiveInteger, contact: Email })) {}

class Cents extends PositiveInteger.subtype('toPlain.Cents') {
  public override toJSON(): string {
    return `${String(this.value)} cents`;
  }
}

const Order = n.object({
  id: Uuid,
  contact: Email,
  paid: AnyBoolean,
  total: Int64,
  placed: Instant,
  note: n.of(AnyString).optional(),
  manager: n.of(Uuid).nullable(),
  stay: Stay,
  tags: n.of(AnyString).array({ max: 3 }),
  lines: n.object({ sku: AnyString, quantity: PositiveInteger }).array(),
});

const orderInput = {
  id,
  contact: 'jane@example.com',
  paid: false,
  total: '9007199254740993',
  placed: '2024-05-01T09:30:00Z',
  manager: null,
  stay: { guests: 2, contact: 'jane@example.com' },
  tags: ['a', 'b'],
  lines: [{ sku: 'TEA', quantity: 1 }],
};

describe('toPlain() of an n.object() schema', () => {
  const order = valueOf(Order.parse(orderInput));

  it('writes every instance in the value as its JSON form', () => {
    expect(Order.toPlain(order)).toStrictEqual({
      id,
      contact: 'jane@example.com',
      paid: false,
      total: '9007199254740993',
      placed: '2024-05-01T09:30:00Z',
      manager: null,
      stay: { guests: 2, contact: 'jane@example.com' },
      tags: ['a', 'b'],
      lines: [{ sku: 'TEA', quantity: 1 }],
    });
  });

  it('writes the same JSON as JSON.stringify() of the value', () => {
    const withNote = valueOf(Order.parse({ ...orderInput, note: 'late', manager: id }));

    expect(JSON.stringify(Order.toPlain(order))).toBe(JSON.stringify(order));
    expect(JSON.stringify(Order.toPlain(withNote))).toBe(JSON.stringify(withNote));
  });

  it('leaves out an optional field that is missing, and keeps one that is there', () => {
    expect(Order.toPlain(order)).not.toHaveProperty('note');
    expect(Order.toPlain(valueOf(Order.parse({ ...orderInput, note: 'late' })))).toHaveProperty(
      'note',
      'late',
    );
  });

  it('keeps only the fields the schema declares', () => {
    const extra = { ...order, secret: 'x' };

    expect(Order.toPlain(extra)).not.toHaveProperty('secret');
  });

  it("doesn't change the value it was given", () => {
    Order.toPlain(order);

    expect(order.id).toBeInstanceOf(Uuid);
    expect(order.lines[0]?.quantity).toBeInstanceOf(PositiveInteger);
  });

  it("uses a class's own toJSON()", () => {
    const Price = n.object({ price: Cents });

    expect(Price.toPlain(valueOf(Price.parse({ price: 250 })))).toStrictEqual({
      price: '250 cents',
    });
  });

  it('writes plain values given in place of instances as they are', () => {
    const Line = n.object({ sku: AnyString, quantity: PositiveInteger });

    expect(toPlainOfAny(Line, { sku: 'TEA', quantity: 2 })).toStrictEqual({
      sku: 'TEA',
      quantity: 2,
    });
  });

  it('falls back to n.plain() for a value that is not an object', () => {
    expect(toPlainOfAny(Order, [new Uuid(id)])).toStrictEqual([id]);
    expect(toPlainOfAny(Order, 'text')).toBe('text');
  });

  it('runs a field from another library through n.plain()', () => {
    const Wrapped = n.object({ meta: z.object({ owner: z.instanceof(Uuid) }) });
    const value = valueOf(Wrapped.parse({ meta: { owner: new Uuid(id) } }));

    expect(Wrapped.toPlain(value)).toStrictEqual({ meta: { owner: id } });
  });

  it('writes types and schemas from another copy of the package', async () => {
    const copy = await anotherCopy();
    const Mixed = n.object({
      id: copy.Uuid,
      tags: copy.n.of(copy.AnyString).array(),
      inner: copy.n.object({ count: copy.PositiveInteger }),
    });
    const value = valueOf(Mixed.parse({ id, tags: ['a'], inner: { count: 2 } }));

    expect(Mixed.toPlain(value)).toStrictEqual({ id, tags: ['a'], inner: { count: 2 } });
  });

  it('types the result with plain values', () => {
    const Line = n.object({
      sku: AnyString,
      quantity: PositiveInteger,
      note: n.of(AnyString).optional(),
    });

    expectTypeOf<ReturnType<typeof Line.toPlain>>().toEqualTypeOf<{
      sku: string;
      quantity: number;
      note?: string;
    }>();
  });
});

describe('toPlain() of n.of() schemas', () => {
  it('writes an instance, a list, an optional and a nullable value', () => {
    expect(n.of(Uuid).toPlain(new Uuid(id))).toBe(id);
    expect(
      n
        .of(Uuid)
        .array()
        .toPlain([new Uuid(id)]),
    ).toStrictEqual([id]);
    expect(n.of(Uuid).optional().toPlain(undefined)).toBeUndefined();
    expect(n.of(Uuid).nullable().toPlain(null)).toBeNull();
    expect(
      n
        .of(Uuid)
        .optional()
        .array()
        .toPlain([undefined, new Uuid(id)]),
    ).toStrictEqual([undefined, id]);
    expect(n.of(PositiveInteger).fromString().toPlain(new PositiveInteger(2))).toBe(2);
    expect(n.of(Stay).toPlain(new Stay({ guests: 1, contact: 'jane@example.com' }))).toStrictEqual({
      guests: 1,
      contact: 'jane@example.com',
    });
  });

  it('writes a list given where a value is expected through n.plain()', () => {
    expect(toPlainOfAny(n.of(Uuid).array(), 'text')).toBe('text');
    expect(toPlainOfAny(n.of(Uuid), [new Uuid(id)])).toStrictEqual([id]);
  });

  it('writes an instance from another copy of the package', async () => {
    const copy = await anotherCopy();

    expect(n.of(Uuid).toPlain(new copy.Uuid(id))).toBe(id);
  });

  it('types the result as the value', () => {
    const Ids = n.of(Uuid).array().nullable();

    expectTypeOf<ReturnType<typeof Ids.toPlain>>().toEqualTypeOf<string[] | null>();
  });
});

describe.each([
  ['generated', true],
  ['loop', false],
])('the %s writer', (_, generate) => {
  const instance = instanceWriter(generate);
  const list = arrayWriter(instance, generate);
  const object = objectWriter(
    [
      { key: 'id', write: instance, optional: false },
      { key: 'note', write: instance, optional: true },
      { key: 'tags', write: list, optional: false },
    ],
    generate,
  );
  const stay = new Stay({ guests: 1, contact: 'jane@example.com' });

  it.each<[string, Write, unknown, unknown]>([
    ['an instance', instance, new Uuid(id), id],
    ['an object instance', instance, stay, { guests: 1, contact: 'jane@example.com' }],
    ['a primitive', instance, 3, 3],
    ['null', instance, null, null],
    ['a plain object', instance, { id: new Uuid(id) }, { id }],
    ['a list', list, [new Uuid(id), 1], [id, 1]],
    ['not a list', list, { id: new Uuid(id) }, { id }],
    ['an object', object, { id: new Uuid(id), tags: [] }, { id, tags: [] }],
    [
      'an object with a note',
      object,
      { id: 1, note: new AnyString('x'), tags: [] },
      { id: 1, note: 'x', tags: [] },
    ],
    ['not an object', object, [new Uuid(id)], [id]],
    ['null for an object', object, null, null],
  ])('writes %s', (_name, write, input, expected) => {
    expect(write(input)).toStrictEqual(expected);
  });
});
