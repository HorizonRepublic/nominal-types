# How to store nominal types with Drizzle

This guide shows how to keep nominal types in [Drizzle](https://orm.drizzle.team) tables, so a column holds an `Email` rather than a `string`, and every value read from the database is checked.

The helper comes from a separate entry point, `@horizon-republic/nominal-types/adapters/drizzle`. It needs nothing from Drizzle itself: it gives the parameters of a custom column, which you pass to the `customType` of your dialect.

## Declaring a column

Make one custom column per type, then use it in tables:

```ts
import { customType, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { toDrizzle } from '@horizon-republic/nominal-types/adapters/drizzle';
import type { DrizzleColumn } from '@horizon-republic/nominal-types/adapters/drizzle';
import { Email, Uuid } from '@horizon-republic/nominal-types';

const email = customType<DrizzleColumn<typeof Email>>(toDrizzle(Email));
const uuid = customType<DrizzleColumn<typeof Uuid>>(toDrizzle(Uuid));

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: email('email').notNull(),
  referrer: uuid('referrer'),
});
```

For PostgreSQL or MySQL, import `customType` from `drizzle-orm/pg-core` or `drizzle-orm/mysql-core` instead. `DrizzleColumn` types the column, so `user.email` is an `Email`.

## The column

The SQL type comes from the nominal type, as in [the MikroORM guide](mikro-orm.md#the-column): `varchar(254)` for `Email`, `uuid` for `Uuid`, `integer` or `bigint` by a number type's bounds, `boolean`. Pass `column` for another; on MySQL, which has no `uuid`, use `toDrizzle(Uuid, { column: 'char(36)' })`.

Booleans are written as `1` and `0`, which every dialect takes.

## Reading, writing and querying

- An instance is stored as its `toJSON()`, or as what `serialize` gives.
- A value read back becomes an instance, checked by the type; a value it refuses throws a `NominalError`, unless `trusted: true`.
- Conditions take instances, so `eq(users.email, new Email('jane@example.com'))` works, and with `serialize` the value is stored the same way. A pattern for `like` reaches the query as it is.

```ts
await db.select().from(users).where(eq(users.email, new Email('jane@example.com')));
await db.select().from(users).where(like(users.email, '%@example.com'));
```

[← Guides](README.md)
