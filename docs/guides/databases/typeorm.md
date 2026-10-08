# How to store nominal types with TypeORM

`toTypeOrm()` lets an entity property hold an `Email` rather than a `string`. Every value read from the database is checked by its type.

## Before you start

- Install the package and the peer dependency (a package you install yourself):

  ```sh
  npm install @horizon-republic/nominal-types typeorm
  ```

- The helper comes from the adapter's entry point, `@horizon-republic/nominal-types/adapters/typeorm`. Nothing from TypeORM loads unless you import it.
- It works with TypeORM 0.3.13 or later, and TypeORM 1.
- TypeORM entities use decorators. Turn on `experimentalDecorators` and `emitDecoratorMetadata` in `tsconfig.json`.

## Quick example

1. Pass `toTypeOrm(Type)` to `@Column()`:

   ```ts
   // user.entity.ts
   import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
   import { Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
   import { toTypeOrm } from '@horizon-republic/nominal-types/adapters/typeorm';

   @Entity()
   export class User {
     @PrimaryGeneratedColumn()
     public id!: number;

     @Column(toTypeOrm(Email))
     public email!: Email;

     @Column(toTypeOrm(Uuid, { nullable: true }))
     public referrer!: Uuid | null;

     @Column(toTypeOrm(PositiveInteger))
     public visits!: PositiveInteger;
   }
   ```

2. Save instances and read them back:

   ```ts
   // main.ts
   import 'reflect-metadata';
   import { DataSource } from 'typeorm';
   import { Email, PositiveInteger } from '@horizon-republic/nominal-types';

   import { User } from './user.entity';

   const source = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: [User], synchronize: true });
   await source.initialize();

   const users = source.getRepository(User);
   await users.save({ email: new Email('jane@example.com'), referrer: null, visits: new PositiveInteger(3) });

   const user = await users.findOneByOrFail({ id: 1 });
   user.email; // Email { value: 'jane@example.com' }
   user.email.domain; // 'example.com'
   user.referrer; // null
   ```

An instance is stored as its `toJSON()`, such as the text of an `Email`. `null` stays `null`.

## Choose the column

The column comes from the type: `varchar(254)` for `Email`, `uuid` for `Uuid`, `bigint` for `PositiveInteger`. The full list is in [Database columns](../../reference/adapters/database-columns.md).

`toTypeOrm()` also takes any TypeORM column option, such as `nullable`, `unique`, or `type` and `length` to choose the column yourself: `toTypeOrm(Email, { type: 'varchar', length: 320 })`.

## Store a different form

Pass `serialize` to store something other than `toJSON()`. This entity stores emails in their canonical form, lowercase and without a `+tag`:

```ts
// user.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Email } from '@horizon-republic/nominal-types';
import { toTypeOrm } from '@horizon-republic/nominal-types/adapters/typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column(toTypeOrm(Email, { unique: true, serialize: (email) => email.canonical().value }))
  public email!: Email;
}
```

Saving `new Email('Jane.Doe@Example.com')` stores `jane.doe@example.com`.

## Query by a value

Find conditions take instances. They go through `serialize` too, so a lookup finds what was stored:

```ts
// find.ts
import { In, Like } from 'typeorm';
import type { Repository } from 'typeorm';
import { Email } from '@horizon-republic/nominal-types';

import { User } from './user.entity';

export const findJane = (users: Repository<User>) =>
  users.findOneBy({ email: new Email('JANE.DOE@example.com') }); // finds jane.doe@example.com

export const findListed = (users: Repository<User>) =>
  users.findBy({ email: In([new Email('jane.doe@example.com'), new Email('bob@example.com')]) });

export const findExampleUsers = (users: Repository<User>) =>
  users.findBy({ email: Like('%@example.com') }); // the pattern is sent as it is
```

## Errors

A stored value the type refuses throws a `NominalError` when the row is read, such as a row written before a rule became stricter:

```text
NominalError: nominal.Email: must be an email address (was a string of 4 characters)
```

A plain value the type refuses is written as it is, so query patterns work. Raw SQL, a migration or another app can store such values too. Reading them throws the error above.

To build instances from stored values without checking them, pass `trusted: true`: `toTypeOrm(Email, { trusted: true })`. A bad stored value then becomes a bad instance, and nothing checks it again. Use it only for a column that nothing else writes to.

## Limits

- SQLite loses digits of large integers. Reading such a value throws a `NominalError`. See [Database columns](../../reference/adapters/database-columns.md) for the fixes.
- `toTypeOrm()` sets the column's `transformer`. Don't pass your own; use `serialize` instead.

## See also

- [TypeORM adapter reference](../../reference/adapters/typeorm.md): every option of `toTypeOrm()`, with defaults.
- [Database columns](../../reference/adapters/database-columns.md): the column for each type, and what SQLite can't hold.
- [How to use nominal types with NestJS](../frameworks/nestjs.md)

[← Guides](../README.md)
