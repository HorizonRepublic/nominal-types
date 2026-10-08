import 'reflect-metadata';
import { Column, DataSource, Entity, PrimaryColumn } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toTypeOrm } from '../../../src/adapters/typeorm/index.ts';
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

@Entity()
class Purchase {
  @PrimaryColumn()
  public id!: number;

  @Column(toTypeOrm(Money))
  public price!: Money;

  @Column(toTypeOrm(Address, { nullable: true }))
  public address!: Address | null;

  @Column(toTypeOrm(Shape, { nullable: true }))
  public shape!: Shape | null;

  @Column(toTypeOrm(Money, { type: 'text', nullable: true }))
  public quote!: Money | null;

  @Column(toTypeOrm(Money, { nullable: true, trusted: true }))
  public trustedPrice!: Money | null;

  @Column(toTypeOrm(DecimalString, { type: 'text', nullable: true }))
  public total!: DecimalString | null;

  @Column(toTypeOrm(DecimalString, { nullable: true }))
  public amount!: DecimalString | null;
}

let source: DataSource;

const firstRow = async (sql: string): Promise<unknown> => {
  const rows: unknown = await source.query(sql);

  return Array.isArray(rows) ? rows[0] : undefined;
};

const tableSql = async (): Promise<string> => {
  const table = await firstRow("select sql from sqlite_master where name = 'purchase'");

  return typeof table === 'object' && table !== null ? String(Reflect.get(table, 'sql')) : '';
};

beforeAll(async () => {
  source = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [Purchase],
    synchronize: true,
  });
  await source.initialize();

  const purchases = source.getRepository(Purchase);

  await purchases.save(
    purchases.create({
      id: 1,
      price,
      address: null,
      shape,
      quote: price,
      trustedPrice: null,
      total,
      amount: null,
    }),
  );
});

afterAll(async () => {
  await source.destroy();
});

describe('toTypeOrm with objects and decimals', () => {
  it('creates a JSON text column for object types, and numeric for DecimalString', async () => {
    const sql = await tableSql();

    expect(sql).toContain('"price" text NOT NULL');
    expect(sql).toContain('"quote" text');
    expect(sql).toContain('"amount" numeric');
  });

  it('stores the plain JSON and reads instances back, null as null', async () => {
    const purchase = await source.getRepository(Purchase).findOneByOrFail({ id: 1 });
    const row = await firstRow('select price, shape, quote from purchase');

    expectStored(row);
    expect(row).toMatchObject({ quote: storedPrice });
    expect(purchase.price).toStrictEqual(price);
    expect(purchase.quote).toStrictEqual(price);
    expect(purchase.shape).toStrictEqual(shape);
    expect(purchase.address).toBeNull();
    expect(purchase.total).toStrictEqual(total);
  });

  it('updates a changed object', async () => {
    const purchases = source.getRepository(Purchase);
    const purchase = await purchases.findOneByOrFail({ id: 1 });

    purchase.address = address;
    await purchases.save(purchase);

    expect((await purchases.findOneByOrFail({ id: 1 })).address).toStrictEqual(address);
  });

  it('throws a NominalError for stored JSON the type refuses, trusted or not', async () => {
    await source.query(`update purchase set "trustedPrice" = '${badPrice}'`);
    await expect(source.getRepository(Purchase).findOneByOrFail({ id: 1 })).rejects.toThrow(
      NominalError,
    );
    await source.query('update purchase set "trustedPrice" = null');
  });

  it('refuses the number SQLite gives for a numeric column', async () => {
    await source.query("update purchase set amount = '12.34'");
    await expect(source.getRepository(Purchase).findOneByOrFail({ id: 1 })).rejects.toThrow(
      lostDigits,
    );
    await source.query('update purchase set amount = null');
  });
});
