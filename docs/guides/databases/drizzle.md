# How to store nominal types with Drizzle

`toDrizzle()` lets a table column hold an `Email` rather than a `string`. Every value read from the database is checked by its type.

## Before you start

- Install the package:

  ```sh
  npm install @horizon-republic/nominal-types
  ```

- The helper comes from the adapter's entry point, `@horizon-republic/nominal-types/adapters/drizzle`. It imports nothing from Drizzle, so it has no peer dependency.
- It works with every dialect: you pass its result to that dialect's `customType`.

## Quick example

1. Make one custom column per type, then use it in a table:

   ```ts
   // schema.ts
   import { customType, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
   import { Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
   import { toDrizzle } from '@horizon-republic/nominal-types/adapters/drizzle';
   import type { DrizzleColumn } from '@horizon-republic/nominal-types/adapters/drizzle';

   const email = customType<DrizzleColumn<typeof Email>>(toDrizzle(Email));
   const uuid = customType<DrizzleColumn<typeof Uuid>>(toDrizzle(Uuid));
   const count = customType<DrizzleColumn<typeof PositiveInteger>>(toDrizzle(PositiveInteger));

   export const users = sqliteTable('users', {
     id: integer('id').primaryKey(),
     email: email('email').notNull(),
     referrer: uuid('referrer'),
     visits: count('visits').notNull(),
   });
   ```

   For PostgreSQL or MySQL, import `customType` from `drizzle-orm/pg-core` or `drizzle-orm/mysql-core`. `DrizzleColumn` types the column, so `user.email` is an `Email`.

2. Insert instances and read them back:

   ```ts
   // main.ts
   import Database from 'better-sqlite3';
   import { drizzle } from 'drizzle-orm/better-sqlite3';
   import { Email, PositiveInteger } from '@horizon-republic/nominal-types';

   import { users } from './schema';

   const db = drizzle(new Database('app.db'));

   await db.insert(users).values({ email: new Email('jane@example.com'), visits: new PositiveInteger(3) });

   const [user] = await db.select().from(users);
   user?.email; // Email { value: 'jane@example.com' }
   user?.email.domain; // 'example.com'
   user?.referrer; // null
   ```

An instance is stored as its `toJSON()`, such as the text of an `Email`. `null` stays `null`.

## Choose the column

The column comes from the type: `varchar(254)` for `Email`, `uuid` for `Uuid`, `bigint` for `PositiveInteger`. The full list is in [Database columns](../../reference/adapters/database-columns.md).

To choose the column yourself, pass `column`, as in `toDrizzle(Email, { column: 'varchar(320)' })`.

## Store a different form

Pass `serialize` to store something other than `toJSON()`. This column stores emails in their canonical form, lowercase and without a `+tag`:

```ts
// schema.ts
import { customType, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Email } from '@horizon-republic/nominal-types';
import { toDrizzle } from '@horizon-republic/nominal-types/adapters/drizzle';
import type { DrizzleColumn } from '@horizon-republic/nominal-types/adapters/drizzle';

const canonicalEmail = customType<DrizzleColumn<typeof Email>>(
  toDrizzle(Email, { serialize: (email) => email.canonical().value }),
);

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: canonicalEmail('email').notNull(),
});
```

Inserting `new Email('Jane.Doe@Example.com')` stores `jane.doe@example.com`.

## Query by a value

Conditions take instances. They go through `serialize` too, so a lookup finds what was stored:

```ts
// find.ts
import { eq, inArray, like } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Email } from '@horizon-republic/nominal-types';

import { users } from './schema';

export const findJane = (db: BetterSQLite3Database) =>
  db.select().from(users).where(eq(users.email, new Email('JANE.DOE@example.com'))); // finds jane.doe@example.com

export const findListed = (db: BetterSQLite3Database) =>
  db.select().from(users).where(inArray(users.email, [new Email('jane.doe@example.com'), new Email('bob@example.com')]));

export const findExampleUsers = (db: BetterSQLite3Database) =>
  db.select().from(users).where(like(users.email, '%@example.com')); // the pattern is sent as it is
```

## Errors

A stored value the type refuses throws a `NominalError` from the query that reads it:

```text
NominalError: nominal.Email: must be an email address (was a string of 4 characters)
```

To build instances without checking stored values, pass `trusted: true`: `toDrizzle(Email, { trusted: true })`. Use it only when every stored value is valid.

## Limits

- MySQL has no `uuid` column. Use `toDrizzle(Uuid, { column: 'char(36)' })`.
- SQLite loses digits of large integers, and reading such a value throws a `NominalError`. See [Database columns](../../reference/adapters/database-columns.md) for the fixes.

## See also

- [Drizzle adapter reference](../../reference/adapters/drizzle.md): every option of `toDrizzle()`, with defaults.
- [Database columns](../../reference/adapters/database-columns.md): the column for each type, and what SQLite can't hold.

[← Guides](../README.md)
