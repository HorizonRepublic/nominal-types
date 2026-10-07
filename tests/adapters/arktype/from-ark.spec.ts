import { type } from 'arktype';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type * as adapter from '../../../src/adapters/arktype/index.ts';
import { toArk, fromArk } from '../../../src/adapters/arktype/index.ts';
import { Email, PositiveInteger, Uuid } from '../../../src/index.ts';
import { issuesOf, outputOf, valueOf } from '../../support/results.ts';

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

const fakeMeta = { description: 'fake', 'x-nominal-type': 'NoSuchType' };

const Profile = fromArk(
  type({
    id: toArk(Uuid),
    email: toArk(Email),
    'backup?': toArk(Email),
    manager: toArk(Uuid).or('null'),
    name: 'string',
  }),
);

describe('fromArk', () => {
  describe('fields', () => {
    it('builds an instance for every toArk() field and keeps the others as they are', () => {
      const value = valueOf(
        Profile.parse({ id, email: 'jane@example.com', manager: null, name: 'J' }),
      );

      expect(value.id).toBeInstanceOf(Uuid);
      expect(value.email).toBeInstanceOf(Email);
      expect(value.manager).toBeNull();
      expect(value.name).toBe('J');
      expect(value).not.toHaveProperty('backup');
    });

    it('builds a present optional field and a nullable field holding a value', () => {
      const value = valueOf(
        Profile.parse({ id, email: 'a@b.co', backup: 'c@d.co', manager: id, name: '' }),
      );

      expect(value.backup).toBeInstanceOf(Email);
      expect(value.manager).toBeInstanceOf(Uuid);
    });

    it('leaves the input as it was', () => {
      const input = { id, email: 'a@b.co', manager: null, name: '' };

      Profile.parse(input);

      expect(input).toStrictEqual({ id, email: 'a@b.co', manager: null, name: '' });
    });

    it('keeps an undeclared key that ArkType keeps', () => {
      const value = valueOf(
        Profile.parse({ id, email: 'a@b.co', manager: null, name: '', extra: 1 }),
      );

      expect(value).toHaveProperty('extra', 1);
    });

    it('types fields as instances and the input as plain values', () => {
      type Value = Extract<ReturnType<typeof Profile.parse>, { ok: true }>['value'];
      type Input = NonNullable<(typeof Profile)['~standard']['types']>['input'];

      expectTypeOf<Value['email']>().toEqualTypeOf<Email>();
      expectTypeOf<Value['manager']>().toEqualTypeOf<Uuid | null>();
      expectTypeOf<Input['email']>().toEqualTypeOf<string>();
    });
  });

  describe('issues', () => {
    it('gives each issue its path and the type message without the path in front', () => {
      expect(
        issuesOf(Profile.parse({ id: 'x', email: 'nope', manager: 1, name: 2 })),
      ).toStrictEqual([
        { message: 'must be an email address (was "nope")', path: ['email'] },
        { message: 'must be a UUID (was "x")', path: ['id'] },
        { message: 'must be a UUID or null (was 1)', path: ['manager'] },
        { message: 'must be a string (was a number)', path: ['name'] },
      ]);
    });

    it('reports a missing field', () => {
      expect(issuesOf(Profile.parse({ id, manager: null, name: '' }))).toStrictEqual([
        { message: 'must be present (was missing)', path: ['email'] },
      ]);
    });

    it('reports input that is not an object without a path', () => {
      expect(issuesOf(Profile.parse('x'))).toStrictEqual([
        { message: 'must be an object (was a string)' },
      ]);
    });
  });

  describe('arrays, tuples and records', () => {
    const Lists = fromArk(
      type({
        ids: toArk(Uuid).array().atLeastLength(1),
        pair: [toArk(Uuid), toArk(PositiveInteger)],
        tail: ['string', '...', toArk(PositiveInteger).array()],
        byName: type({ '[string]': toArk(Email) }),
      }),
    );
    const input = {
      ids: [id, id],
      pair: [id, 2],
      tail: ['label', 1, 2],
      byName: { jane: 'jane@example.com' },
    };

    it('builds instances in each place', () => {
      const value = valueOf(Lists.parse(input));

      expect(value.ids.every((item) => item instanceof Uuid)).toBe(true);
      expect(value.pair[0]).toBeInstanceOf(Uuid);
      expect(value.pair[1]).toBeInstanceOf(PositiveInteger);
      expect(value.tail).toStrictEqual(['label', new PositiveInteger(1), new PositiveInteger(2)]);
      expect(value.byName['jane']).toBeInstanceOf(Email);
    });

    it('keeps the length rules of ArkType', () => {
      expect(issuesOf(Lists.parse({ ...input, ids: [] }))).toStrictEqual([
        { message: 'must be non-empty', path: ['ids'] },
      ]);
    });

    it('reports a bad item by its index', () => {
      expect(issuesOf(Lists.parse({ ...input, ids: [id, 'x'] }))).toStrictEqual([
        { message: 'must be a UUID (was "x")', path: ['ids', 1] },
      ]);
    });
  });

  describe('nesting and unions', () => {
    it('builds instances inside nested objects and arrays of objects', () => {
      const Order = fromArk(
        type({
          customer: { email: toArk(Email) },
          items: type({ quantity: toArk(PositiveInteger) }).array(),
        }),
      );
      const value = valueOf(
        Order.parse({ customer: { email: 'a@b.co' }, items: [{ quantity: 2 }] }),
      );

      expect(value.customer.email).toBeInstanceOf(Email);
      expect(value.items[0]?.quantity).toBeInstanceOf(PositiveInteger);
    });

    it('tells union branches apart by a literal field', () => {
      const Contact = fromArk(
        type({ kind: "'email'", to: toArk(Email) }).or({ kind: "'id'", to: toArk(Uuid) }),
      );

      expect(valueOf(Contact.parse({ kind: 'email', to: 'a@b.co' })).to).toBeInstanceOf(Email);
      expect(valueOf(Contact.parse({ kind: 'id', to: id })).to).toBeInstanceOf(Uuid);
    });

    it('tells a nominal branch from a plain one by the type itself', () => {
      const Reference = fromArk(type({ ref: toArk(Uuid).or('number') }));

      expect(valueOf(Reference.parse({ ref: id })).ref).toBeInstanceOf(Uuid);
      expect(valueOf(Reference.parse({ ref: 7 })).ref).toBe(7);
    });

    it('builds the instance after a morph that ends in an toArk() node', () => {
      const Invite = fromArk(type({ email: type('string.trim').pipe(toArk(Email)) }));
      const value = valueOf(Invite.parse({ email: '  jane@example.com ' }));

      expect(value.email).toBeInstanceOf(Email);
      expect(value.email.value).toBe('jane@example.com');
    });

    it('keeps other morphs of ArkType', () => {
      const Search = fromArk(type({ query: 'string.trim', id: toArk(Uuid) }));

      expect(valueOf(Search.parse({ query: ' a ', id })).query).toBe('a');
    });
  });

  describe('more places', () => {
    it('builds elements after the rest of a tuple, counted from the end', () => {
      const Tail = fromArk(type(['string', '...', toArk(Uuid).array(), toArk(PositiveInteger)]));

      expect(valueOf(Tail.parse(['x', id, id, 3]))).toStrictEqual([
        'x',
        new Uuid(id),
        new Uuid(id),
        new PositiveInteger(3),
      ]);
      expect(valueOf(Tail.parse(['x', 3]))).toStrictEqual(['x', new PositiveInteger(3)]);
    });

    it('builds a branch that trims before the type, or null', () => {
      const Invite = fromArk(type({ email: type('string.trim').pipe(toArk(Email)).or('null') }));

      expect(valueOf(Invite.parse({ email: ' a@b.co ' })).email).toStrictEqual(new Email('a@b.co'));
      expect(valueOf(Invite.parse({ email: null })).email).toBeNull();
    });

    it('tells two nominal types apart in a union', () => {
      const Reference = fromArk(type({ to: toArk(Email).or(toArk(Uuid)) }));

      expect(valueOf(Reference.parse({ to: id })).to).toBeInstanceOf(Uuid);
      expect(valueOf(Reference.parse({ to: 'a@b.co' })).to).toBeInstanceOf(Email);
    });

    it('tells a single object or array branch from a nominal one', () => {
      const Either = fromArk(
        type({
          one: toArk(Email).or(type({ id: toArk(Uuid) })),
          many: toArk(Uuid).or(toArk(Uuid).array()),
        }),
      );
      const value = valueOf(Either.parse({ one: { id }, many: [id] }));

      expect(value.one).toStrictEqual({ id: new Uuid(id) });
      expect(value.many).toStrictEqual([new Uuid(id)]);
    });

    it('builds a type from another copy of the adapter too', async () => {
      vi.resetModules();
      const copy: typeof adapter = await import('../../../src/adapters/arktype/index.ts');
      const Copied = copy.fromArk(type({ id: toArk(Uuid) }));

      expect(valueOf(Copied.parse({ id })).id).toBeInstanceOf(Uuid);
    });
  });

  describe('places it refuses', () => {
    it.each([
      ['a morph after an toArk() node', () => type({ email: toArk(Email).pipe((email) => email) })],
      [
        'a union of objects without a literal field',
        () => type({ to: toArk(Email) }).or({ id: toArk(Uuid) }),
      ],
      ['a union of arrays', () => toArk(Email).array().or(toArk(Uuid).array())],
      ['two index signatures', () => type({ '[string]': toArk(Email), '[symbol]': toArk(Uuid) })],
      ['a type name no toArk() gave', () => type({ a: type('string').configure(fakeMeta) })],
    ])('throws for %s', (_name, build) => {
      expect(() => fromArk(build())).toThrow(TypeError);
    });
  });

  it('is a Standard Schema', () => {
    const value = outputOf(
      Profile['~standard'].validate({ id, email: 'a@b.co', manager: null, name: '' }),
    );

    expect(value.id).toBeInstanceOf(Uuid);
    expect(Profile['~standard'].vendor).toBe('@horizon-republic/nominal-types');
  });

  it('runs a schema with no toArk() node like ArkType', () => {
    expect(valueOf(fromArk(type({ a: 'string' })).parse({ a: 'x' }))).toStrictEqual({ a: 'x' });
  });
});
