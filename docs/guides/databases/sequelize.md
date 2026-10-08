# How to store nominal types with Sequelize

`toSequelize()` lets a model attribute hold an `Email` rather than a `string`. Every value read from the database is checked by its type.

## Before you start

- Install the package and the peer dependency (a package you install yourself):

  ```sh
  npm install @horizon-republic/nominal-types sequelize
  ```

- The helper comes from the adapter's entry point, `@horizon-republic/nominal-types/adapters/sequelize`. Nothing from Sequelize loads unless you import it.
- It works with Sequelize 6.

## Quick example

1. Pass `toSequelize(Type)` as the attribute:

   ```ts
   // user.model.ts
   import { Model, Sequelize } from 'sequelize';
   import { Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
   import { toSequelize } from '@horizon-republic/nominal-types/adapters/sequelize';

   export const sequelize = new Sequelize({ dialect: 'sqlite', storage: 'app.db' });

   export class User extends Model {
     declare public email: Email;
     declare public referrer: Uuid | null;
     declare public visits: PositiveInteger;
   }

   User.init(
     {
       email: toSequelize(Email),
       referrer: toSequelize(Uuid, { allowNull: true }),
       visits: toSequelize(PositiveInteger),
     },
     { sequelize },
   );
   ```

2. Create a row and read it back:

   ```ts
   // main.ts
   import { Email, PositiveInteger } from '@horizon-republic/nominal-types';

   import { sequelize, User } from './user.model';

   await sequelize.sync();
   await User.create({ email: new Email('jane@example.com'), visits: new PositiveInteger(3) });

   const user = await User.findOne();
   user?.email; // Email { value: 'jane@example.com' }
   user?.email.domain; // 'example.com'
   user?.referrer; // null
   JSON.stringify(user); // '{"email":"jane@example.com","referrer":null,"visits":3,...}'
   ```

Setting an attribute stores the instance's `toJSON()`, such as the text of an `Email`. `null` stays `null`.

## Choose the column

The column comes from the type: `STRING(254)` for `Email`, `UUID` for `Uuid`, `BIGINT` for `PositiveInteger`. The full list is in [Database columns](../../reference/adapters/database-columns.md).

`toSequelize()` also takes any Sequelize attribute option, such as `allowNull`, `unique`, `field` for the column name, or `type` to choose the column yourself: `toSequelize(Email, { type: DataTypes.STRING(320) })`.

## Store a different form

Pass `serialize` to store something other than `toJSON()`. This model stores emails in their canonical form, lowercase and without a `+tag`:

```ts
// user.model.ts
import { Model, Sequelize } from 'sequelize';
import { Email } from '@horizon-republic/nominal-types';
import { toSequelize } from '@horizon-republic/nominal-types/adapters/sequelize';

export const sequelize = new Sequelize({ dialect: 'sqlite', storage: 'app.db' });

export class User extends Model {
  declare public email: Email;
}

User.init(
  { email: toSequelize(Email, { unique: true, serialize: (email) => email.canonical().value }) },
  { sequelize },
);
```

Creating a user with `new Email('Jane.Doe@Example.com')` stores `jane.doe@example.com`.

## Query by a value

`where` doesn't take instances. Compare with the stored form, `email.value`, or what `serialize` gives:

```ts
// find.ts
import { Op } from 'sequelize';
import { Email } from '@horizon-republic/nominal-types';

import { User } from './user.model';

export const findByEmail = (email: Email) =>
  User.findOne({ where: { email: email.canonical().value } }); // the same form serialize stores

export const findExampleUsers = () =>
  User.findAll({ where: { email: { [Op.like]: '%@example.com' } } });
```

## Errors

A stored value the type refuses throws a `NominalError` when you read the attribute, not when you find the row:

```text
NominalError: nominal.Email: must be an email address (was a string of 4 characters)
```

A plain value the type refuses is written as it is. Raw SQL, a migration or another app can store such values too. Reading them throws the error above.

To build instances from stored values without checking them, pass `trusted: true`: `toSequelize(Email, { trusted: true })`. A bad stored value then becomes a bad instance, and nothing checks it again. Use it only for a column that nothing else writes to.

## Limits

- An instance in `where` throws `Error: Invalid value Email { value: 'jane@example.com' }`. Pass the stored form, as in [Query by a value](#query-by-a-value).
- `user.toJSON()` returns instances. To send a row, use `JSON.stringify(user)`, which gives plain values.
- SQLite loses digits of large integers, and reading such a value throws a `NominalError`. See [Database columns](../../reference/adapters/database-columns.md) for the fixes.

## See also

- [Sequelize adapter reference](../../reference/adapters/sequelize.md): every option of `toSequelize()`, with defaults.
- [Database columns](../../reference/adapters/database-columns.md): the column for each type, and what SQLite can't hold.

[← Guides](../README.md)
