import { type } from 'arktype';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { objectShape } from '../../src/core/object-shape.ts';
import { Rejection } from '../../src/core/rejection.ts';
import type * as library from '../../src/index.ts';
import { AnyString, Email, n, Nominal, PositiveInteger } from '../../src/index.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const Item = n.object({ sku: AnyString, quantity: PositiveInteger });

const Order = n.object({
  email: Email,
  items: Item.array({ min: 1 }),
  note: n.of(AnyString).optional(),
  backup: n.of(Email).nullable(),
});

const valid = { email: 'jane@example.com', items: [{ sku: 'a', quantity: 2 }], backup: null };

describe('n.object', () => {
  describe('fields', () => {
    it('builds an instance for every field, nested objects and arrays included', () => {
      const order = valueOf(Order.parse(valid));

      expect(order.email).toBeInstanceOf(Email);
      expect(order.items[0]?.quantity).toBeInstanceOf(PositiveInteger);
      expect(order.backup).toBeNull();
    });

    it('returns a new object, not frozen, and leaves the input as it was', () => {
      const input = { ...valid, items: [{ sku: 'a', quantity: 2 }] };
      const order = valueOf(Order.parse(input));

      expect(Object.isFrozen(order)).toBe(false);
      expect(order).not.toBe(input);
      expect(input.items[0]).toStrictEqual({ sku: 'a', quantity: 2 });
    });

    it('drops keys it does not declare', () => {
      const order = valueOf(Order.parse({ ...valid, extra: 1, __proto__: { polluted: true } }));

      expect(Object.keys(order)).toStrictEqual(['email', 'items', 'backup']);
      expect(Reflect.get(order, 'polluted')).toBeUndefined();
    });

    it('leaves a missing optional field out, and checks a present one', () => {
      expect(valueOf(Order.parse(valid))).not.toHaveProperty('note');
      expect(valueOf(Order.parse({ ...valid, note: undefined }))).not.toHaveProperty('note');
      expect(valueOf(Order.parse({ ...valid, note: 'x' })).note).toBeInstanceOf(AnyString);
      expect(issuesOf(Order.parse({ ...valid, note: 5 }))).toStrictEqual([
        { message: 'must be a string (was 5)', path: ['note'] },
      ]);
    });

    it('takes instances as they are', () => {
      const email = new Email('jane@example.com');

      expect(valueOf(Order.parse({ ...valid, email })).email).toBe(email);
    });

    it('takes a schema from another library for a plain field', () => {
      const Limit = n.object({ value: type('number > 0') });

      expect(valueOf(Limit.parse({ value: 2 }))).toStrictEqual({ value: 2 });
      expect(issuesOf(Limit.parse({ value: 0 }))).toHaveLength(1);
    });

    it('refuses a field named __proto__', () => {
      expect(() => n.object(Object.fromEntries([['__proto__', PositiveInteger]]))).toThrow(
        new TypeError('n.object(): a field cannot be named __proto__'),
      );
    });
  });

  describe('issues', () => {
    it('collects every issue, with the path from the top', () => {
      expect(
        issuesOf(Order.parse({ email: 'x', items: [{ sku: 1, quantity: 0 }], backup: 'y' })),
      ).toStrictEqual([
        { message: 'must be an email address (was a string of 1 character)', path: ['email'] },
        { message: 'must be a string (was 1)', path: ['items', 0, 'sku'] },
        { message: 'must be a positive integer (was 0)', path: ['items', 0, 'quantity'] },
        { message: 'must be an email address (was a string of 1 character)', path: ['backup'] },
      ]);
    });

    it('reports a missing required field', () => {
      expect(issuesOf(Order.parse({ items: valid.items, backup: null }))).toStrictEqual([
        { message: 'is required', path: ['email'] },
      ]);
    });

    it.each([
      ['a string', 'x', 'must be an object (was "x")'],
      ['null', null, 'must be an object (was null)'],
      ['an array', [], 'must be an object (was array)'],
      ['undefined', undefined, 'must be an object (was undefined)'],
    ])('rejects %s in place of the object', (_name, input, message) => {
      expect(issuesOf(Order.parse(input))).toStrictEqual([{ message }]);
    });
  });

  it('refuses such a constraint on a subtype or variant of a type built on n.object()', () => {
    const fits = n.constraint(
      { guests: PositiveInteger, capacity: PositiveInteger },
      ({ guests, capacity }) => guests <= capacity,
    );
    const Party = Nominal('objects.Party', n.object({ guests: PositiveInteger }));
    const Room = Nominal(
      'objects.Room',
      n.object({ guests: PositiveInteger, capacity: PositiveInteger }),
    );

    expect(() => Party.subtype('objects.SmallParty', fits)).toThrow(
      new TypeError('subtype: a constraint reads capacity, which the object does not declare'),
    );
    expect(() => Party.variant('objects.OtherParty', fits)).toThrow(
      new TypeError('variant: a constraint reads capacity, which the object does not declare'),
    );
    expect(Room.subtype('objects.FittingRoom', fits).parse({ guests: 3, capacity: 2 }).ok).toBe(
      false,
    );
  });

  it('refuses a constraint that reads a field the object does not declare', () => {
    const fits = n.constraint(
      { guests: PositiveInteger, capacity: PositiveInteger },
      ({ guests, capacity }) => guests <= capacity,
    );

    expect(() => n.object({ guests: PositiveInteger }, fits)).toThrow(
      new TypeError('n.object: a constraint reads capacity, which the object does not declare'),
    );
    expect(() =>
      n.object({ guests: PositiveInteger, capacity: PositiveInteger }, fits),
    ).not.toThrow();
  });

  describe('strict()', () => {
    it('refuses every key it does not declare, each by its path', () => {
      expect(issuesOf(Order.strict().parse({ ...valid, a: 1, b: 2 }))).toStrictEqual([
        { message: 'is not allowed', path: ['a'] },
        { message: 'is not allowed', path: ['b'] },
      ]);
    });

    it('accepts an object with only the declared keys, and leaves the original lenient', () => {
      expect(Order.strict().parse(valid).ok).toBe(true);
      expect(Order.parse({ ...valid, a: 1 }).ok).toBe(true);
    });
  });

  describe('constraints', () => {
    const Range = n.object(
      { start: PositiveInteger, end: PositiveInteger },
      n.constraint(
        { start: PositiveInteger, end: PositiveInteger },
        ({ start, end }) => end > start,
        {
          path: 'end',
        },
      ),
    );

    it('runs after the fields, with the issue on its path', () => {
      expect(Range.parse({ start: 1, end: 2 }).ok).toBe(true);
      expect(issuesOf(Range.parse({ start: 2, end: 1 }))).toStrictEqual([
        { message: 'must agree with start', path: ['end'] },
      ]);
    });

    it('does not run when a field fails', () => {
      const check = vi.fn<() => boolean>(() => true);
      const Checked = n.object({ a: PositiveInteger }, n.constraint({ a: PositiveInteger }, check));

      expect(Checked.parse({ a: 0 }).ok).toBe(false);
      expect(check).not.toHaveBeenCalled();
    });
  });

  describe('shapes around it', () => {
    it('makes optional and nullable objects', () => {
      expect(Item.optional().parse(undefined)).toStrictEqual({ ok: true, value: undefined });
      expect(Item.nullable().parse(null)).toStrictEqual({ ok: true, value: null });
    });
  });

  describe('the generated function and the loop', () => {
    const fields = [
      { key: 'a', run: (value: unknown) => value, optional: false, describe: () => ({}) },
      {
        key: 'b',
        run: (value: unknown) => (value === 'bad' ? new Rejection([{ message: 'bad' }]) : value),
        optional: true,
        describe: () => ({}),
      },
    ];

    it.each([true, false])('agree with code generation %o', (generate) => {
      const { run } = objectShape(fields, [], true, generate);

      expect(run({ a: 1 })).toStrictEqual({ a: 1 });
      expect(run({ a: 1, b: 2 })).toStrictEqual({ a: 1, b: 2 });
      expect(run({ a: 1, b: 'bad', c: 3 })).toStrictEqual(
        new Rejection([
          { message: 'bad', path: ['b'] },
          { message: 'is not allowed', path: ['c'] },
        ]),
      );
      expect(run('x')).toBeInstanceOf(Rejection);
    });

    it.each([true, false])(
      'run constraints once the fields pass, with generation %o',
      (generate) => {
        const never = n.constraint({ a: type('unknown') }, () => false, { message: 'never' });
        const { run } = objectShape(fields, [never], false, generate);

        expect(run({ a: 1 })).toStrictEqual(new Rejection([{ message: 'never' }]));
        expect(run({ a: 1, b: 'bad' })).toStrictEqual(
          new Rejection([{ message: 'bad', path: ['b'] }]),
        );
      },
    );
  });

  describe('JSON Schema', () => {
    it('describes the fields and the required ones, open on the input side', () => {
      const schema = Item['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

      expect(schema).toMatchObject({
        type: 'object',
        properties: {
          sku: { title: 'nominal.AnyString' },
          quantity: { title: 'nominal.PositiveInteger' },
        },
        required: ['sku', 'quantity'],
      });
      expect(schema).not.toHaveProperty('additionalProperties');
    });

    it('closes the output side, and the input side of a strict object', () => {
      expect(Item['~standard'].jsonSchema.output({ target: 'draft-07' })).toMatchObject({
        additionalProperties: false,
      });
      expect(Item.strict()['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toMatchObject({
        additionalProperties: false,
      });
    });

    it('leaves an optional field out of required', () => {
      expect(Order['~standard'].jsonSchema.input({ target: 'draft-07' })).toMatchObject({
        required: ['email', 'items', 'backup'],
      });
    });
  });

  describe('types', () => {
    it('types required and optional fields from their schemas', () => {
      type Value = Extract<ReturnType<typeof Order.parse>, { ok: true }>['value'];

      expectTypeOf<Value['email']>().toEqualTypeOf<Email>();
      expectTypeOf<Value['note']>().toEqualTypeOf<AnyString | undefined>();
      expectTypeOf<Value['backup']>().toEqualTypeOf<Email | null>();
    });
  });

  it('is recognised, also from another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../src/index.ts');

    expect(n.isObject(Order)).toBe(true);
    expect(n.isObject(copy.n.object({ a: copy.Email }))).toBe(true);
    expect(n.isObject(n.of(Email))).toBe(false);
  });

  it('rejects a bad value in a field built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../src/index.ts');
    const Mixed = n.object({
      id: copy.n.of(copy.Email),
      items: copy.n.object({ quantity: copy.PositiveInteger }).array(),
    });

    expect(issuesOf(Mixed.parse({ id: 'jane', items: [{ quantity: 0 }] }))).toStrictEqual([
      { message: 'must be an email address (was a string of 4 characters)', path: ['id'] },
      { message: 'must be a positive integer (was 0)', path: ['items', 0, 'quantity'] },
    ]);
    expect(valueOf(Mixed.parse({ id: 'jane@example.com', items: [] })).id).toBeInstanceOf(Email);
  });
});
