import Database from 'better-sqlite3';
import { eq, inArray, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { customType, getTableConfig, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';

import { toDrizzle } from '../../../src/adapters/drizzle/index.ts';
import type { DrizzleColumn } from '../../../src/adapters/drizzle/index.ts';
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

const email = customType<DrizzleColumn<typeof Email>>(
  toDrizzle(Email, { serialize: (value) => value.canonical().value }),
);
const uuid = customType<DrizzleColumn<typeof Uuid>>(toDrizzle(Uuid));
const visits = customType<DrizzleColumn<typeof PositiveInteger>>(toDrizzle(PositiveInteger));
const balance = customType<DrizzleColumn<typeof Int64>>(toDrizzle(Int64));
const flag = customType<DrizzleColumn<typeof AnyBoolean>>(toDrizzle(AnyBoolean));
const nickname = customType<DrizzleColumn<typeof Email>>(
  toDrizzle(Email, { column: 'varchar(64)', trusted: true }),
);
const site = customType<DrizzleColumn<typeof Url>>(toDrizzle(Url));
const supply = customType<DrizzleColumn<typeof Uint64>>(toDrizzle(Uint64));
const rating = customType<DrizzleColumn<typeof AnyNumber>>(toDrizzle(AnyNumber));
const level = customType<DrizzleColumn<typeof Int16>>(toDrizzle(Int16));

const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: email('email').notNull(),
  referrer: uuid('referrer'),
  visits: visits('visits').notNull(),
  balance: balance('balance').notNull(),
  active: flag('active').notNull(),
  nickname: nickname('nickname'),
  site: site('site'),
  supply: supply('supply'),
  rating: rating('rating'),
  level: level('level'),
});

const columnTypes = Object.fromEntries(
  getTableConfig(users).columns.map((column) => [column.name, column.getSQLType()]),
);

const open = (): ReturnType<typeof drizzle> => {
  const sqlite = new Database(':memory:');

  sqlite.exec(
    `create table users (${Object.entries(columnTypes)
      .map(([name, type]) => `${name} ${name === 'id' ? 'integer primary key' : type}`)
      .join(', ')})`,
  );

  return drizzle(sqlite);
};

describe('toDrizzle', () => {
  it('gives each column its SQL type, or the one given', () => {
    expect(columnTypes).toMatchObject({
      email: 'varchar(254)',
      referrer: 'uuid',
      visits: 'bigint',
      balance: 'bigint',
      active: 'boolean',
      nickname: 'varchar(64)',
      site: 'text',
      supply: 'decimal(20, 0)',
      rating: 'double precision',
      level: 'integer',
    });
  });

  it('writes and reads instances, null as null, and finds by instances and patterns', async () => {
    const db = open();

    await db.insert(users).values({
      id: 1,
      email: new Email('Jane.Doe@Example.com'),
      referrer: null,
      visits: new PositiveInteger(3),
      balance: new Int64(42n),
      active: new AnyBoolean(true),
      site: new Url('https://example.com'),
      supply: new Uint64(20n),
      rating: new AnyNumber(4.5),
      level: new Int16(-3),
    });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, new Email('JANE.DOE@example.com')));

    expect(user?.email.value).toBe('jane.doe@example.com');
    expect(user?.visits).toStrictEqual(new PositiveInteger(3));
    expect(user?.balance).toStrictEqual(new Int64(42n));
    expect(user?.active).toStrictEqual(new AnyBoolean(true));
    expect(user?.referrer).toBeNull();
    expect(user?.supply).toStrictEqual(new Uint64(20n));
    expect(user?.level).toStrictEqual(new Int16(-3));
    expect(await db.select().from(users).where(like(users.email, '%@example.com'))).toHaveLength(1);
    expect(
      await db
        .select()
        .from(users)
        .where(inArray(users.email, [new Email('x@y.co'), new Email('jane.doe@example.com')])),
    ).toHaveLength(1);
  });

  it('throws a NominalError for a stored value the type refuses, unless trusted', async () => {
    const db = open();

    db.$client.exec(
      "insert into users (id, email, visits, balance, active, nickname) values (1, 'bad', 1, 1, 1, 'bad')",
    );

    await expect(db.select().from(users)).rejects.toThrow(NominalError);
    expect((await db.select({ nickname: users.nickname }).from(users))[0]?.nickname?.value).toBe(
      'bad',
    );
  });
});
