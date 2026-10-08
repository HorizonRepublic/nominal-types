# How to store nominal types with MikroORM

`toMikroOrm()` lets an entity property hold an `Email` rather than a `string`. Every value read from the database is checked by its type.

## Before you start

- Install the package and the peer dependency (a package you install yourself):

  ```sh
  npm install @horizon-republic/nominal-types @mikro-orm/core
  ```

- The helper comes from the adapter's entry point, `@horizon-republic/nominal-types/adapters/mikro-orm`. Nothing from MikroORM loads unless you import it.
- It works with MikroORM 7, with `defineEntity()` and with decorators.

## Quick example

1. Give `toMikroOrm(Type)` as the property's type:

   ```ts
   // user.entity.ts
   import { defineEntity } from '@mikro-orm/core';
   import { Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
   import { toMikroOrm } from '@horizon-republic/nominal-types/adapters/mikro-orm';

   export const User = defineEntity({
     name: 'User',
     properties: (p) => ({
       id: p.integer().primary(),
       email: p.type(toMikroOrm(Email)),
       referrer: p.type(toMikroOrm(Uuid)).nullable(),
       visits: p.type(toMikroOrm(PositiveInteger)),
     }),
   });
   ```

   With decorators, write `@Property({ type: toMikroOrm(Email) })`.

2. Save instances and read them back:

   ```ts
   // main.ts
   import { MikroORM } from '@mikro-orm/sqlite';
   import { Email, PositiveInteger } from '@horizon-republic/nominal-types';

   import { User } from './user.entity';

   const orm = await MikroORM.init({ entities: [User], dbName: ':memory:' });
   await orm.schema.create();

   const em = orm.em.fork();
   em.create(User, { id: 1, email: new Email('jane@example.com'), referrer: null, visits: new PositiveInteger(3) });
   await em.flush();

   const user = await orm.em.fork().findOneOrFail(User, { id: 1 });
   user.email; // Email { value: 'jane@example.com' }
   user.email.domain; // 'example.com'
   user.referrer; // null
   ```

An instance is stored as its `toJSON()`, such as the text of an `Email`. `null` stays `null`.

## Choose the column

The column comes from the type: `varchar(254)` for `Email`, `uuid` for `Uuid`, `bigint` for `PositiveInteger`. The full list is in [Database columns](../../reference/adapters/database-columns.md).

To choose the column yourself, pass `column`, as in `toMikroOrm(Email, { column: 'varchar(320)' })`.

## Store a different form

Pass `serialize` to store something other than `toJSON()`. This entity stores emails in their canonical form, lowercase and without a `+tag`:

```ts
// user.entity.ts
import { defineEntity } from '@mikro-orm/core';
import { Email } from '@horizon-republic/nominal-types';
import { toMikroOrm } from '@horizon-republic/nominal-types/adapters/mikro-orm';

export const User = defineEntity({
  name: 'User',
  properties: (p) => ({
    id: p.integer().primary(),
    email: p.type(toMikroOrm(Email, { serialize: (email) => email.canonical().value })),
  }),
});
```

Saving `new Email('Jane.Doe@Example.com')` stores `jane.doe@example.com`.

## Query by a value

Conditions take instances. They go through `serialize` too, so a lookup finds what was stored:

```ts
// find.ts
import type { EntityManager } from '@mikro-orm/core';
import { Email } from '@horizon-republic/nominal-types';

import { User } from './user.entity';

export const findJane = (em: EntityManager) =>
  em.findOne(User, { email: new Email('JANE.DOE@example.com') }); // finds jane.doe@example.com

export const findExampleUsers = (em: EntityManager) =>
  em.find(User, { email: { $like: '%@example.com' } }); // the pattern is sent as it is
```

## Errors

A stored value the type refuses throws a `NominalError` when the row is read, such as a row written before a rule became stricter:

```text
NominalError: nominal.Email: must be an email address (was a string of 4 characters)
```

A plain value the type refuses is written as it is, so query patterns work. Raw SQL, a migration or another app can store such values too. Reading them throws the error above.

To build instances from stored values without checking them, pass `trusted: true`: `toMikroOrm(Email, { trusted: true })`. A bad stored value then becomes a bad instance, and nothing checks it again. Use it only for a column that nothing else writes to.

## Limits

- SQLite loses digits of large integers. Reading such a value throws a `NominalError`. See [Database columns](../../reference/adapters/database-columns.md) for the fixes.
- TypeScript refuses a plain string as an exact match. Write `{ email: new Email('jane@example.com') }`, not `{ email: 'jane@example.com' }`.

## See also

- [MikroORM adapter reference](../../reference/adapters/mikro-orm.md): every option of `toMikroOrm()`, with defaults.
- [Database columns](../../reference/adapters/database-columns.md): the column for each type, and what SQLite can't hold.
- [How to use nominal types with NestJS](../frameworks/nestjs.md)

[← Guides](../README.md)
