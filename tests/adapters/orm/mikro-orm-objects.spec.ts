import { defineEntity, MikroORM } from '@mikro-orm/sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toMikroOrm } from '../../../src/adapters/mikro-orm/index.ts';
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
  total,
} from '../../support/orm-objects.ts';

const Order = defineEntity({
  name: 'Order',
  properties: (p) => ({
    id: p.integer().primary(),
    price: p.type(toMikroOrm(Money)),
    address: p.type(toMikroOrm(Address)).nullable(),
    shape: p.type(toMikroOrm(Shape)).nullable(),
    trustedPrice: p.type(toMikroOrm(Money, { trusted: true })).nullable(),
    total: p.type(toMikroOrm(DecimalString, { column: 'text' })).nullable(),
    amount: p.type(toMikroOrm(DecimalString)).nullable(),
  }),
});

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({ entities: [Order], dbName: ':memory:' });
  await orm.schema.create();

  const em = orm.em.fork();

  em.create(Order, {
    id: 1,
    price,
    address: null,
    shape,
    trustedPrice: null,
    total,
    amount: null,
  });
  await em.flush();
});

afterAll(async () => {
  await orm.close();
});

describe('toMikroOrm with objects and decimals', () => {
  it('creates a JSON column for object types, and numeric for DecimalString', async () => {
    const sql = await orm.schema.getCreateSchemaSQL();

    expect(sql).toContain('`price` json not null');
    expect(sql).toContain('`address` json null');
    expect(sql).toContain('`shape` json null');
    expect(sql).toContain('`total` text null');
    expect(sql).toContain('`amount` numeric null');
  });

  it('stores the plain JSON and reads instances back, null as null', async () => {
    const order = await orm.em.fork().findOneOrFail(Order, { id: 1 });
    const [row] = await orm.em.getConnection().execute('select `price`, `shape` from `order`');

    expectStored(row);
    expect(order.price).toStrictEqual(price);
    expect(order.price.amount).toBeInstanceOf(DecimalString);
    expect(order.shape).toStrictEqual(shape);
    expect(order.address).toBeNull();
    expect(order.total).toStrictEqual(total);
  });

  it('finds by a whole value only when its JSON text is the same', async () => {
    const em = orm.em.fork();
    const same = new Money({ amount: '12.3', currency: 'EUR' });

    expect(same.equals(price)).toBe(true);
    expect(await em.count(Order, { price })).toBe(1);
    expect(await em.count(Order, { price: same })).toBe(0);
  });

  it('updates a changed object', async () => {
    const em = orm.em.fork();
    const order = await em.findOneOrFail(Order, { id: 1 });

    order.address = address;
    order.price = price.add(new Money({ amount: '1', currency: 'EUR' }));
    await em.flush();

    const saved = await orm.em.fork().findOneOrFail(Order, { id: 1 });

    expect(saved.address).toStrictEqual(address);
    expect(saved.price.amount.value).toBe('13.30');
  });

  it('throws a NominalError for stored JSON the type refuses, trusted or not', async () => {
    const connection = orm.em.getConnection();

    await connection.execute(`update \`order\` set \`trusted_price\` = '${badPrice}'`);
    await expect(orm.em.fork().findOneOrFail(Order, { id: 1 })).rejects.toThrow(NominalError);
    await connection.execute('update `order` set `trusted_price` = null');
  });

  it('refuses the number SQLite gives for a numeric column', async () => {
    const connection = orm.em.getConnection();

    await connection.execute("update `order` set `amount` = '12.34'");
    await expect(orm.em.fork().findOneOrFail(Order, { id: 1 })).rejects.toThrow(
      `${lostDigits} (was 12.34)`,
    );
    await connection.execute('update `order` set `amount` = null');
  });
});
