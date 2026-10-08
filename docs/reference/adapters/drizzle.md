# drizzle

Entry point: `@horizon-republic/nominal-types/adapters/drizzle`. It imports nothing from `drizzle-orm`: you pass its result to the `customType` of your dialect.

| Export           | Kind     | Use it for                                                       |
| ---------------- | -------- | ---------------------------------------------------------------- |
| `toDrizzle()`    | function | the parameters of a custom column that holds a nominal type      |
| `DrizzleColumn`  | type     | the type argument of `customType`, so the column holds instances |
| `DrizzleOptions` | type     | the options of `toDrizzle()`                                     |
| `DrizzleParams`  | type     | what `toDrizzle()` returns                                       |

## toDrizzle()

```ts
function toDrizzle<Target extends AnyNominalType>(
  target: Target,
  options?: DrizzleOptions<Target['prototype']>,
): DrizzleParams<Target>;
```

| Parameter | Type             | Description                       |
| --------- | ---------------- | --------------------------------- |
| `target`  | nominal type     | the type the column holds         |
| `options` | `DrizzleOptions` | optional; see [Options](#options) |

Returns `{ dataType, toDriver, fromDriver }`. Pass it to `customType` from `drizzle-orm/sqlite-core`, `drizzle-orm/pg-core` or `drizzle-orm/mysql-core`, as `customType<DrizzleColumn<typeof Email>>(toDrizzle(Email))`.

| Member       | Does                                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| `dataType()` | returns the SQL type, such as `'varchar(254)'`                                    |
| `toDriver`   | turns a value into what is stored; booleans become `1` and `0`, objects JSON text |
| `fromDriver` | turns a stored value into an instance, checked unless `trusted`                   |

### Options

| Option      | Type                 | Default                                                    | Description                                              |
| ----------- | -------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| `column`    | `string`             | from the type, see [Database columns](database-columns.md) | the SQL type, such as `'char(36)'` for a UUID on MySQL   |
| `serialize` | `(value) => unknown` | the instance's `toJSON()`                                  | what is stored; also runs on condition values            |
| `trusted`   | `boolean`            | `false`                                                    | build instances from stored values without checking them |

### Errors

A query that reads a stored value the type rejects throws a `NominalError`.

## Example

```ts
import Database from 'better-sqlite3';
import { eq, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { customType, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { toDrizzle } from '@horizon-republic/nominal-types/adapters/drizzle';
import type { DrizzleColumn } from '@horizon-republic/nominal-types/adapters/drizzle';
import { Email } from '@horizon-republic/nominal-types';

const email = customType<DrizzleColumn<typeof Email>>(toDrizzle(Email));
const customers = sqliteTable('customers', { id: integer('id').primaryKey(), email: email('email').notNull() });

const sqlite = new Database(':memory:');
sqlite.exec('create table customers (id integer primary key, email varchar(254) not null)');
const db = drizzle(sqlite);
await db.insert(customers).values({ id: 1, email: new Email('jane@example.com') });

const [found] = await db.select().from(customers).where(eq(customers.email, new Email('jane@example.com')));
found?.email; // Email
await db.select().from(customers).where(like(customers.email, '%@example.com')); // 1 row

sqlite.exec("update customers set email = 'bad'");
await db.select().from(customers);
// throws NominalError: nominal.Email: must be an email address (was a string of 3 characters)
```

## See also

- [Database columns](database-columns.md)
- [How to store nominal types with Drizzle](../../guides/databases/drizzle.md)

[← Adapters](README.md) · [← Reference](../README.md)
