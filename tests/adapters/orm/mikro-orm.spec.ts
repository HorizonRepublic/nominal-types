import { defineEntity, MikroORM } from '@mikro-orm/sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toMikroOrm } from '../../../src/adapters/mikro-orm/index.ts';
import {
  AnyBoolean,
  AnyNumber,
  Email,
  Int16,
  Int64,
  NominalError,
  PositiveInteger,
  Uint64,
  Url,
  Uuid,
} from '../../../src/index.ts';

const User = defineEntity({
  name: 'User',
  properties: (p) => ({
    id: p.integer().primary(),
    email: p.type(toMikroOrm(Email, { serialize: (email) => email.canonical().value })),
    referrer: p.type(toMikroOrm(Uuid)).nullable(),
    visits: p.type(toMikroOrm(PositiveInteger)),
    balance: p.type(toMikroOrm(Int64)),
    active: p.type(toMikroOrm(AnyBoolean)),
    nickname: p.type(toMikroOrm(Email, { column: 'varchar(64)', trusted: true })).nullable(),
    site: p.type(toMikroOrm(Url)).nullable(),
    supply: p.type(toMikroOrm(Uint64)).nullable(),
    rating: p.type(toMikroOrm(AnyNumber)).nullable(),
    level: p.type(toMikroOrm(Int16)).nullable(),
  }),
});

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({ entities: [User], dbName: ':memory:' });
  await orm.schema.create();

  const em = orm.em.fork();

  em.create(User, {
    id: 1,
    email: new Email('Jane.Doe@Example.com'),
    referrer: null,
    visits: new PositiveInteger(3),
    balance: new Int64(42n),
    active: new AnyBoolean(true),
    nickname: null,
    site: new Url('https://example.com'),
    supply: new Uint64(20n),
    rating: new AnyNumber(4.5),
    level: new Int16(-3),
  });
  await em.flush();
});

afterAll(async () => {
  await orm.close();
});

describe('toMikroOrm', () => {
  it('creates columns from the types, or the column given', async () => {
    const sql = await orm.schema.getCreateSchemaSQL();

    expect(sql).toContain('`visits` bigint not null');
    expect(sql).toContain('`active` integer not null');
    expect(sql).toContain('`nickname` varchar(64) null');
    expect(sql).toContain('`site` text null');
    expect(sql).toContain('`supply` numeric(20,0) null');
    expect(sql).toContain('`rating` double null');
    expect(sql).toContain('`level` integer null');
    expect(sql).toContain('`referrer` text null');
  });

  it('reads instances back, and null as null', async () => {
    const user = await orm.em.fork().findOneOrFail(User, { id: 1 });

    expect(user.email).toBeInstanceOf(Email);
    expect(user.email.value).toBe('jane.doe@example.com');
    expect(user.visits).toStrictEqual(new PositiveInteger(3));
    expect(user.balance).toStrictEqual(new Int64(42n));
    expect(user.active).toStrictEqual(new AnyBoolean(true));
    expect(user.referrer).toBeNull();
    expect(user.site?.value).toBe('https://example.com');
    expect(user.rating?.value).toBe(4.5);
  });

  it('serializes query values, instances and plain ones, as it stores them', async () => {
    const em = orm.em.fork();
    const plain = Object.fromEntries([['email', 'Jane.Doe@Example.com']]);
    const listed = Object.fromEntries([
      ['email', { $in: [new Email('x@y.co'), 'jane.doe@example.com'] }],
    ]);

    expect(await em.count(User, { email: new Email('JANE.DOE@example.com') })).toBe(1);
    expect(await em.count(User, plain)).toBe(1);
    expect(await em.count(User, listed)).toBe(1);
  });

  it('passes a pattern through to the query', async () => {
    expect(await orm.em.fork().count(User, { email: { $like: '%@example.com' } })).toBe(1);
  });

  it('updates a changed instance', async () => {
    const em = orm.em.fork();
    const user = await em.findOneOrFail(User, { id: 1 });

    user.visits = new PositiveInteger(4);
    await em.flush();

    expect((await orm.em.fork().findOneOrFail(User, { id: 1 })).visits.value).toBe(4);
  });

  it('throws a NominalError for a stored value the type refuses, unless trusted', async () => {
    await orm.em
      .getConnection()
      .execute("update `user` set `email` = 'bad', `nickname` = 'bad' where `id` = 1");

    await expect(orm.em.fork().findOneOrFail(User, { id: 1 })).rejects.toThrow(NominalError);

    await orm.em
      .getConnection()
      .execute("update `user` set `email` = 'jane.doe@example.com' where `id` = 1");

    expect((await orm.em.fork().findOneOrFail(User, { id: 1 })).nickname?.value).toBe('bad');
  });

  it('names the type class after the type', () => {
    expect(toMikroOrm(Email).name).toBe('nominal.EmailType');
  });
});
