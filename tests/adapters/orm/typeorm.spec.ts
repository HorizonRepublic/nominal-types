import 'reflect-metadata';
import { Column, DataSource, Entity, In, Like, PrimaryColumn } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toTypeOrm } from '../../../src/adapters/typeorm/index.ts';
import {
  AnyBoolean,
  AnyNumber,
  Email,
  Int64,
  NominalError,
  PositiveInteger,
  Uint64,
  Url,
  Uuid,
} from '../../../src/index.ts';

@Entity()
class Account {
  @PrimaryColumn()
  public id!: number;

  @Column(toTypeOrm(Email, { serialize: (email) => email.canonical().value }))
  public email!: Email;

  @Column(toTypeOrm(Uuid, { nullable: true }))
  public referrer!: Uuid | null;

  @Column(toTypeOrm(PositiveInteger))
  public visits!: PositiveInteger;

  @Column(toTypeOrm(Int64))
  public balance!: Int64;

  @Column(toTypeOrm(AnyBoolean))
  public active!: AnyBoolean;

  @Column(toTypeOrm(Email, { type: 'varchar', length: 64, nullable: true, trusted: true }))
  public nickname!: Email | null;

  @Column(toTypeOrm(Url, { nullable: true }))
  public site!: Url | null;

  @Column(toTypeOrm(Uint64, { nullable: true }))
  public supply!: Uint64 | null;

  @Column(toTypeOrm(AnyNumber, { nullable: true }))
  public rating!: AnyNumber | null;
}

let source: DataSource;

const tableSql = async (): Promise<string> => {
  const rows: unknown = await source.query("select sql from sqlite_master where name = 'account'");
  const first: unknown = Array.isArray(rows) ? rows[0] : undefined;

  return typeof first === 'object' && first !== null ? String(Reflect.get(first, 'sql')) : '';
};

beforeAll(async () => {
  source = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [Account],
    synchronize: true,
  });
  await source.initialize();

  const accounts = source.getRepository(Account);

  await accounts.save(
    accounts.create({
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
    }),
  );
});

afterAll(async () => {
  await source.destroy();
});

describe('toTypeOrm', () => {
  it('creates columns from the types, or the options given', async () => {
    const sql = await tableSql();

    expect(sql).toContain('"email" varchar(254) NOT NULL');
    expect(sql).toContain('"visits" bigint NOT NULL');
    expect(sql).toContain('"active" boolean NOT NULL');
    expect(sql).toContain('"nickname" varchar(64)');
    expect(sql).toContain('"site" text');
    expect(sql).toContain('"supply" decimal(20,0)');
    expect(sql).toContain('"rating" double precision');
  });

  it('reads instances back, and null as null', async () => {
    const account = await source.getRepository(Account).findOneByOrFail({ id: 1 });

    expect(account.email.value).toBe('jane.doe@example.com');
    expect(account.visits).toStrictEqual(new PositiveInteger(3));
    expect(account.balance).toStrictEqual(new Int64(42n));
    expect(account.active).toStrictEqual(new AnyBoolean(true));
    expect(account.referrer).toBeNull();
    expect(account.supply).toStrictEqual(new Uint64(20n));
    expect(account.rating?.value).toBe(4.5);
  });

  it('serializes find values as it stores them, and passes patterns through', async () => {
    const accounts = source.getRepository(Account);

    expect(await accounts.findOneBy({ email: new Email('JANE.DOE@example.com') })).not.toBeNull();
    expect(await accounts.findBy({ email: In(['Jane.Doe@Example.com', 'x@y.co']) })).toHaveLength(
      1,
    );
    expect(await accounts.findBy({ email: Like('%@example.com') })).toHaveLength(1);
  });

  it('throws a NominalError for a stored value the type refuses, unless trusted', async () => {
    await source.query("update account set email = 'bad', nickname = 'bad' where id = 1");

    await expect(source.getRepository(Account).findOneByOrFail({ id: 1 })).rejects.toThrow(
      NominalError,
    );

    await source.query("update account set email = 'jane.doe@example.com' where id = 1");

    expect((await source.getRepository(Account).findOneByOrFail({ id: 1 })).nickname?.value).toBe(
      'bad',
    );
  });
});
