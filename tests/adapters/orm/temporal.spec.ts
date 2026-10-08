import 'reflect-metadata';
import 'temporal-polyfill/global';
import { defineEntity, MikroORM } from '@mikro-orm/sqlite';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { customType, getTableConfig, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Model } from 'sequelize';
import { Column, DataSource, Entity, PrimaryColumn } from 'typeorm';
import { describe, expect, it } from 'vitest';

import { toDrizzle } from '../../../src/adapters/drizzle/index.ts';
import type { DrizzleColumn } from '../../../src/adapters/drizzle/index.ts';
import { toMikroOrm } from '../../../src/adapters/mikro-orm/index.ts';
import { columnKindOf } from '../../../src/adapters/orm/column.ts';
import { readerOf } from '../../../src/adapters/orm/values.ts';
import { toSequelize } from '../../../src/adapters/sequelize/index.ts';
import { toTypeOrm } from '../../../src/adapters/typeorm/index.ts';
import { n, NominalError } from '../../../src/index.ts';
import { Instant, PlainDate, PlainDateTime, PlainTime } from '../../../src/temporal/index.ts';
// One file covers the Temporal columns of every ORM, so it imports each of them.
// oxlint-disable-next-line import/max-dependencies
import { memorySequelize } from '../../support/node-sqlite.ts';

const sent = '2024-05-01T09:30:00.123Z';
const due = '2024-02-29';
const opens = '09:30:00.25';
const meeting = '2024-05-01T09:30:00';

class Deadline extends Instant.subtype(
  'columns.Deadline',
  n.satisfying(
    (value: unknown): value is Temporal.Instant =>
      value instanceof Temporal.Instant && value.epochMilliseconds > 0,
    'after 1970',
    {},
  ),
) {}

describe('columnKindOf for the Temporal types', () => {
  it.each([
    [Instant, { kind: 'timestamptz' }],
    [Deadline, { kind: 'timestamptz' }],
    [PlainDate, { kind: 'date' }],
    [PlainTime, { kind: 'time' }],
    [PlainDateTime, { kind: 'timestamp' }],
  ])('stores %o in %o', (target, kind) => {
    expect(columnKindOf(target)).toStrictEqual(kind);
  });
});

describe('reading Temporal types from a driver', () => {
  it('reads a Date as an instant, to the millisecond', () => {
    const read = readerOf(Instant, { kind: 'timestamptz' }, false);

    expect(read(new Date(sent))).toStrictEqual(new Instant(sent));
  });

  it('refuses an invalid Date', () => {
    const read = readerOf(Instant, { kind: 'timestamptz' }, false);

    expect(() => read(new Date(Number.NaN))).toThrow(NominalError);
  });

  it.each([
    [PlainDate, { kind: 'date' } as const],
    [PlainDateTime, { kind: 'timestamp' } as const],
  ])('refuses a Date for %o, whose local time the process zone shifts', (target, kind) => {
    expect(() => readerOf(target, kind, false)(new Date(sent))).toThrow(NominalError);
  });
});

describe('toDrizzle with Temporal types', () => {
  const events = sqliteTable('events', {
    id: integer('id').primaryKey(),
    sent: customType<DrizzleColumn<typeof Instant>>(toDrizzle(Instant))('sent').notNull(),
    due: customType<DrizzleColumn<typeof PlainDate>>(toDrizzle(PlainDate))('due').notNull(),
    opens: customType<DrizzleColumn<typeof PlainTime>>(toDrizzle(PlainTime))('opens').notNull(),
    meeting: customType<DrizzleColumn<typeof PlainDateTime>>(toDrizzle(PlainDateTime))(
      'meeting',
    ).notNull(),
  });
  const columnTypes = Object.fromEntries(
    getTableConfig(events).columns.map((column) => [column.name, column.getSQLType()]),
  );

  it('gives each column its SQL type', () => {
    expect(columnTypes).toMatchObject({
      sent: 'timestamptz',
      due: 'date',
      opens: 'time',
      meeting: 'timestamp',
    });
  });

  it('writes the text and reads instances back', async () => {
    const sqlite = new Database(':memory:');

    sqlite.exec(
      'create table events (id integer primary key, sent timestamptz, due date, opens time, meeting timestamp)',
    );

    const db = drizzle(sqlite);

    await db.insert(events).values({
      id: 1,
      sent: new Instant('2024-05-01T11:30:00.123+02:00'),
      due: new PlainDate(due),
      opens: new PlainTime(opens),
      meeting: new PlainDateTime(meeting),
    });

    expect(sqlite.prepare('select sent, due, opens, meeting from events').get()).toStrictEqual({
      sent,
      due,
      opens: '09:30:00.25',
      meeting,
    });

    const [event] = await db.select().from(events);

    expect(event?.sent.equals(new Instant(sent))).toBe(true);
    expect(event?.due.equals(new PlainDate(due))).toBe(true);
    expect(event?.opens.equals(new PlainTime(opens))).toBe(true);
    expect(event?.meeting.equals(new PlainDateTime(meeting))).toBe(true);
  });
});

@Entity()
class Shift {
  @PrimaryColumn()
  public id!: number;

  @Column(toTypeOrm(Instant, { type: 'datetime' }))
  public sent!: Instant;

  @Column(toTypeOrm(PlainDate))
  public due!: PlainDate;

  @Column(toTypeOrm(PlainTime))
  public opens!: PlainTime;

  @Column(toTypeOrm(PlainDateTime, { type: 'varchar', length: 29 }))
  public meeting!: PlainDateTime;
}

describe('toTypeOrm with Temporal types', () => {
  it('gives each column its type', () => {
    expect(toTypeOrm(Instant)).toMatchObject({ type: 'timestamptz' });
    expect(toTypeOrm(PlainDate)).toMatchObject({ type: 'date' });
    expect(toTypeOrm(PlainTime)).toMatchObject({ type: 'time' });
    expect(toTypeOrm(PlainDateTime)).toMatchObject({ type: 'timestamp' });
  });

  it('reads instances back from SQLite, an instant through the Date TypeORM hands over', async () => {
    const source = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Shift],
      synchronize: true,
    });

    await source.initialize();

    try {
      const shifts = source.getRepository(Shift);

      await shifts.save(
        shifts.create({
          id: 1,
          sent: new Instant(sent),
          due: new PlainDate(due),
          opens: new PlainTime(opens),
          meeting: new PlainDateTime(meeting),
        }),
      );

      const shift = await shifts.findOneByOrFail({ id: 1 });

      expect(shift.sent.equals(new Instant(sent))).toBe(true);
      expect(shift.due.equals(new PlainDate(due))).toBe(true);
      expect(shift.opens.equals(new PlainTime(opens))).toBe(true);
      expect(shift.meeting.equals(new PlainDateTime(meeting))).toBe(true);
    } finally {
      await source.destroy();
    }
  });
});

describe('toSequelize with Temporal types', () => {
  class Booking extends Model {
    declare public sent: Instant;
    declare public due: PlainDate;
    declare public opens: PlainTime;
    declare public meeting: PlainDateTime;
  }

  const sequelize = memorySequelize();

  Booking.init(
    {
      sent: toSequelize(Instant),
      due: toSequelize(PlainDate),
      opens: toSequelize(PlainTime),
      meeting: toSequelize(PlainDateTime),
    },
    { sequelize },
  );

  it('gives each attribute its column type', () => {
    const types = Object.fromEntries(
      // rawAttributes: Sequelize 6.1, the oldest release supported, has no getAttributes()
      // oxlint-disable-next-line typescript/no-deprecated
      Object.entries(Booking.rawAttributes).map(([name, attribute]) => [
        name,
        String(attribute.type),
      ]),
    );

    expect(types).toMatchObject({
      sent: 'DATETIME',
      due: 'DATE',
      opens: 'TIME',
      meeting: 'TIMESTAMP',
    });
  });

  it('writes and reads instances', async () => {
    await sequelize.sync();

    try {
      await Booking.create({
        sent: new Instant(sent),
        due: new PlainDate(due),
        opens: new PlainTime(opens),
        meeting: new PlainDateTime(meeting),
      });

      const booking = await Booking.findOne();

      expect(booking?.sent.equals(new Instant(sent))).toBe(true);
      expect(booking?.due.equals(new PlainDate(due))).toBe(true);
      expect(booking?.opens.equals(new PlainTime(opens))).toBe(true);
      expect(booking?.meeting.equals(new PlainDateTime(meeting))).toBe(true);
    } finally {
      await sequelize.close();
    }
  });
});

describe('toMikroOrm with Temporal types', () => {
  const Visit = defineEntity({
    name: 'Visit',
    properties: (p) => ({
      id: p.integer().primary(),
      sent: p.type(toMikroOrm(Instant)),
      due: p.type(toMikroOrm(PlainDate)),
      opens: p.type(toMikroOrm(PlainTime)),
      meeting: p.type(toMikroOrm(PlainDateTime)),
    }),
  });

  it('creates columns and reads instances back', async () => {
    const orm = await MikroORM.init({ entities: [Visit], dbName: ':memory:' });

    try {
      await orm.schema.create();

      const sql = await orm.schema.getCreateSchemaSQL();

      expect(sql).toContain('`sent` datetime not null');
      expect(sql).toContain('`due` date not null');
      expect(sql).toContain('`opens` time(6) not null');
      expect(sql).toContain('`meeting` datetime not null');

      const em = orm.em.fork();

      em.create(Visit, {
        id: 1,
        sent: new Instant(sent),
        due: new PlainDate(due),
        opens: new PlainTime(opens),
        meeting: new PlainDateTime(meeting),
      });
      await em.flush();

      const visit = await orm.em.fork().findOneOrFail(Visit, { id: 1 });

      expect(visit.sent.equals(new Instant(sent))).toBe(true);
      expect(visit.due.equals(new PlainDate(due))).toBe(true);
      expect(visit.opens.equals(new PlainTime(opens))).toBe(true);
      expect(visit.meeting.equals(new PlainDateTime(meeting))).toBe(true);
    } finally {
      await orm.close();
    }
  });
});
