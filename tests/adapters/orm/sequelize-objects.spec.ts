import { DataTypes, Model, QueryTypes } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toSequelize } from '../../../src/adapters/sequelize/index.ts';
import { DecimalString, Money, NominalError } from '../../../src/index.ts';
import { memorySequelize } from '../../support/node-sqlite.ts';
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

class Sale extends Model {
  declare public price: Money;
  declare public address: Address | null;
  declare public shape: Shape | null;
  declare public quote: Money | null;
  declare public trustedPrice: Money | null;
  declare public total: DecimalString | null;
  declare public amount: DecimalString | null;
}

const sequelize = memorySequelize();

Sale.init(
  {
    price: toSequelize(Money),
    address: toSequelize(Address, { allowNull: true }),
    shape: toSequelize(Shape, { allowNull: true }),
    quote: toSequelize(Money, { type: DataTypes.TEXT, allowNull: true }),
    trustedPrice: toSequelize(Money, { allowNull: true, trusted: true }),
    total: toSequelize(DecimalString, { type: DataTypes.TEXT, allowNull: true }),
    amount: toSequelize(DecimalString, { allowNull: true }),
  },
  { sequelize },
);

beforeAll(async () => {
  await sequelize.sync();
  await Sale.create({ price, address: null, shape, quote: price, total });
});

afterAll(async () => {
  await sequelize.close();
});

describe('toSequelize with objects and decimals', () => {
  it('gives object types a JSON column, and DecimalString DECIMAL', () => {
    const types = Object.fromEntries(
      // rawAttributes: Sequelize 6.1, the oldest release supported, has no getAttributes()
      // oxlint-disable-next-line typescript/no-deprecated
      Object.entries(Sale.rawAttributes).map(([key, attribute]) => [key, String(attribute.type)]),
    );

    expect(types).toMatchObject({
      price: 'JSON',
      address: 'JSON',
      shape: 'JSON',
      quote: 'TEXT',
      total: 'TEXT',
      amount: 'DECIMAL',
    });
  });

  it('stores the plain JSON and reads instances back, null as null', async () => {
    const sale = await Sale.findOne();
    const [row] = await sequelize.query('select price, shape, quote from Sales', {
      type: QueryTypes.SELECT,
    });

    expectStored(row);
    expect(row).toMatchObject({ quote: storedPrice });
    expect(sale?.price).toStrictEqual(price);
    expect(sale?.quote).toStrictEqual(price);
    expect(sale?.shape).toStrictEqual(shape);
    expect(sale?.address).toBeNull();
    expect(sale?.total).toStrictEqual(total);
  });

  it('writes a changed object', async () => {
    const sale = await Sale.findOne();

    sale?.set('address', address);
    await sale?.save();

    expect((await Sale.findOne())?.address).toStrictEqual(address);
  });

  it('throws a NominalError for stored JSON the type refuses, trusted or not', async () => {
    await sequelize.query(`update Sales set trustedPrice = '${badPrice}'`);

    const sale = await Sale.findOne();

    expect(() => sale?.trustedPrice).toThrow(NominalError);
    await sequelize.query('update Sales set trustedPrice = null');
  });

  it('refuses the number SQLite gives for a numeric column', async () => {
    await sequelize.query("update Sales set amount = '12.34'");

    const sale = await Sale.findOne();

    expect(() => sale?.amount).toThrow(lostDigits);
  });
});
