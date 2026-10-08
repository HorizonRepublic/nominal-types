import 'temporal-polyfill/global';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { customType, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';

import { toDrizzle } from '../../../src/adapters/drizzle/index.ts';
import type { DrizzleColumn } from '../../../src/adapters/drizzle/index.ts';
import { columnKindOf } from '../../../src/adapters/orm/column.ts';
import { Duration, TimeZoneId, ZonedDateTime } from '../../../src/temporal/index.ts';

describe('columnKindOf for the Temporal types stored as text', () => {
  it.each([ZonedDateTime, Duration, TimeZoneId])('stores %o in text', (target) => {
    expect(columnKindOf(target)).toStrictEqual({ kind: 'text' });
  });
});

describe('toDrizzle with the Temporal types stored as text', () => {
  const trips = sqliteTable('trips', {
    id: integer('id').primaryKey(),
    departs: customType<DrizzleColumn<typeof ZonedDateTime>>(toDrizzle(ZonedDateTime))(
      'departs',
    ).notNull(),
    lasts: customType<DrizzleColumn<typeof Duration>>(toDrizzle(Duration))('lasts').notNull(),
    zone: customType<DrizzleColumn<typeof TimeZoneId>>(toDrizzle(TimeZoneId))('zone').notNull(),
  });

  it('keeps the zone, the units of the duration and the name as given', async () => {
    const sqlite = new Database(':memory:');

    sqlite.exec('create table trips (id integer primary key, departs text, lasts text, zone text)');

    const db = drizzle(sqlite);
    const departs = '2024-10-27T02:30:00+01:00[Europe/Paris]';

    await db.insert(trips).values({
      id: 1,
      departs: new ZonedDateTime(departs),
      lasts: new Duration('PT90M'),
      zone: new TimeZoneId('europe/paris'),
    });

    expect(sqlite.prepare('select departs, lasts, zone from trips').get()).toStrictEqual({
      departs,
      lasts: 'PT90M',
      zone: 'europe/paris',
    });

    const [trip] = await db.select().from(trips);

    expect(trip?.departs.equals(new ZonedDateTime(departs))).toBe(true);
    expect(trip?.lasts.equals(new Duration('PT90M'))).toBe(true);
    expect(trip?.zone.value).toBe('europe/paris');
  });
});
