import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { customType, getTableConfig, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';

import { toDrizzle } from '../../../src/adapters/drizzle/index.ts';
import type { DrizzleColumn } from '../../../src/adapters/drizzle/index.ts';
import { DecimalString, Money, NominalError } from '../../../src/index.ts';
import {
  Address,
  address,
  badPrice,
  expectStored,
  lostDigits,
  price,
  Shape,
  shape,
  storedPrice,
  total,
} from '../../support/orm-objects.ts';

const money = customType<DrizzleColumn<typeof Money>>(toDrizzle(Money));
const trustedMoney = customType<DrizzleColumn<typeof Money>>(toDrizzle(Money, { trusted: true }));
const place = customType<DrizzleColumn<typeof Address>>(toDrizzle(Address));
const figure = customType<DrizzleColumn<typeof Shape>>(toDrizzle(Shape));
const exact = customType<DrizzleColumn<typeof DecimalString>>(
  toDrizzle(DecimalString, { column: 'text' }),
);
const decimal = customType<DrizzleColumn<typeof DecimalString>>(toDrizzle(DecimalString));

const orders = sqliteTable('orders', {
  id: integer('id').primaryKey(),
  price: money('price').notNull(),
  address: place('address'),
  shape: figure('shape'),
  trustedPrice: trustedMoney('trusted_price'),
  total: exact('total'),
  amount: decimal('amount'),
});

const columnTypes = Object.fromEntries(
  getTableConfig(orders).columns.map((column) => [column.name, column.getSQLType()]),
);

const open = (): ReturnType<typeof drizzle> => {
  const sqlite = new Database(':memory:');

  sqlite.exec(
    `create table orders (${Object.entries(columnTypes)
      .map(([name, type]) => `${name} ${name === 'id' ? 'integer primary key' : type}`)
      .join(', ')})`,
  );

  return drizzle(sqlite);
};

describe('toDrizzle with objects and decimals', () => {
  it('gives object types a json column, and DecimalString numeric', () => {
    expect(columnTypes).toMatchObject({
      price: 'json',
      address: 'json',
      shape: 'json',
      total: 'text',
      amount: 'numeric',
    });
  });

  it('stores the plain JSON as text and reads instances back, null as null', async () => {
    const db = open();

    await db.insert(orders).values({ id: 1, price, address: null, shape, total });

    const [order] = await db.select().from(orders);

    expectStored(db.$client.prepare('select price, shape from orders').get());
    expect(order?.price).toStrictEqual(price);
    expect(order?.shape).toStrictEqual(shape);
    expect(order?.address).toBeNull();
    expect(order?.total).toStrictEqual(total);
  });

  it('finds by a whole value only when its JSON text is the same, and updates', async () => {
    const db = open();
    const same = new Money({ amount: '12.3', currency: 'EUR' });

    await db.insert(orders).values({ id: 1, price });

    expect(await db.select().from(orders).where(eq(orders.price, price))).toHaveLength(1);
    expect(await db.select().from(orders).where(eq(orders.price, same))).toHaveLength(0);

    await db.update(orders).set({ address }).where(eq(orders.id, 1));

    expect((await db.select().from(orders))[0]?.address).toStrictEqual(address);
  });

  it('throws a NominalError for stored JSON the type refuses, trusted or not', async () => {
    const db = open();

    db.$client.exec(
      `insert into orders (id, price, trusted_price) values (1, '${storedPrice}', '${badPrice}')`,
    );

    await expect(db.select().from(orders)).rejects.toThrow(NominalError);
  });

  it('refuses the number SQLite gives for a numeric column', async () => {
    const db = open();

    db.$client.exec(`insert into orders (id, price, amount) values (1, '${storedPrice}', '12.34')`);

    await expect(db.select().from(orders)).rejects.toThrow(lostDigits);
  });
});
