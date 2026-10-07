import { DataTypes, Model, Op, Sequelize } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toSequelize } from '../../../src/adapters/sequelize/index.ts';
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

class User extends Model {
  declare public email: Email;
  declare public referrer: Uuid | null;
  declare public visits: PositiveInteger;
  declare public balance: Int64;
  declare public active: AnyBoolean;
  declare public nickname: Email | null;
  declare public site: Url | null;
  declare public supply: Uint64 | null;
  declare public rating: AnyNumber | null;
  declare public level: Int16 | null;
}

const sequelize = new Sequelize('sqlite::memory:', { logging: false });

User.init(
  {
    email: toSequelize(Email, { serialize: (email) => email.canonical().value, unique: true }),
    referrer: toSequelize(Uuid, { allowNull: true }),
    visits: toSequelize(PositiveInteger),
    balance: toSequelize(Int64),
    active: toSequelize(AnyBoolean),
    nickname: toSequelize(Email, { type: DataTypes.STRING(64), allowNull: true, trusted: true }),
    site: toSequelize(Url, { allowNull: true }),
    supply: toSequelize(Uint64, { allowNull: true }),
    rating: toSequelize(AnyNumber, { allowNull: true }),
    level: toSequelize(Int16, { allowNull: true }),
  },
  { sequelize },
);

beforeAll(async () => {
  await sequelize.sync();
  await User.create({
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
});

afterAll(async () => {
  await sequelize.close();
});

describe('toSequelize', () => {
  it('gives each attribute its column type, or the one given', () => {
    const types = Object.fromEntries(
      Object.entries(User.getAttributes()).map(([key, attribute]) => [key, String(attribute.type)]),
    );

    expect(types).toMatchObject({
      email: 'VARCHAR(254)',
      referrer: 'UUID',
      visits: 'BIGINT',
      balance: 'BIGINT',
      active: 'TINYINT(1)',
      nickname: 'VARCHAR(64)',
      site: 'TEXT',
      supply: 'DECIMAL(20)',
      rating: 'DOUBLE PRECISION',
      level: 'INTEGER',
    });
  });

  it('reads instances back, and null as null', async () => {
    const user = await User.findOne({ where: { email: 'jane.doe@example.com' } });

    expect(user?.email.value).toBe('jane.doe@example.com');
    expect(user?.visits).toStrictEqual(new PositiveInteger(3));
    expect(user?.balance).toStrictEqual(new Int64(42n));
    expect(user?.active).toStrictEqual(new AnyBoolean(true));
    expect(user?.supply).toStrictEqual(new Uint64(20n));
    expect(user?.level).toStrictEqual(new Int16(-3));
    expect(user?.referrer).toBeNull();
  });

  it('finds by what is stored, and by patterns', async () => {
    expect(await User.count({ where: { email: { [Op.like]: '%@example.com' } } })).toBe(1);
  });

  it('writes a changed instance, and serializes it', async () => {
    const user = await User.findOne();

    user?.set('email', new Email('JANE.DOE@example.com'));
    user?.set('visits', new PositiveInteger(4));
    await user?.save();

    const saved = await User.findOne();

    expect(saved?.visits.value).toBe(4);
    expect(saved?.email.value).toBe('jane.doe@example.com');
  });

  it('throws a NominalError for a stored value the type refuses, unless trusted', async () => {
    await sequelize.query("update Users set email = 'bad', nickname = 'bad'");

    const user = await User.findOne();

    expect(() => user?.email).toThrow(NominalError);
    expect(user?.nickname?.value).toBe('bad');
  });
});
