# How to store nominal types with Sequelize

This guide shows how to keep nominal types in [Sequelize](https://sequelize.org) 6 models, so an attribute holds an `Email` rather than a `string`, and every value read from the database is checked.

The helper comes from a separate entry point, `@horizon-republic/nominal-types/adapters/sequelize`. You only need `sequelize` if you import it.

## Declaring an attribute

Pass `toSequelize(Type)` as the attribute:

```ts
import { Model } from 'sequelize';
import { toSequelize } from '@horizon-republic/nominal-types/adapters/sequelize';
import { Email, Uuid } from '@horizon-republic/nominal-types';

export class User extends Model {
  declare public email: Email;
  declare public referrer: Uuid | null;
}

User.init(
  {
    email: toSequelize(Email, { unique: true }),
    referrer: toSequelize(Uuid, { allowNull: true }),
  },
  { sequelize },
);
```

`toSequelize()` takes any Sequelize attribute option as well, such as `allowNull`, `unique`, `field` for the column's name, or `type` to choose the column yourself.

## The column

The column comes from the type, as in [the MikroORM guide](mikro-orm.md#the-column): `STRING(254)` for `Email`, `UUID` for `Uuid`, `INTEGER` or `BIGINT` by a number type's bounds, `BOOLEAN`.

## Reading and writing

- Setting the attribute stores the instance's `toJSON()`, or what `serialize` gives.
- Reading it gives an instance, checked by the type; a value it refuses throws a `NominalError` when read, unless `trusted: true`.
- `model.toJSON()` gives the stored values, ready to send.

## Querying

Sequelize checks `where` values itself and refuses objects, and it doesn't run attribute setters on them. Compare with what is stored:

```ts
await User.findOne({ where: { email: email.value } });
await User.findAll({ where: { email: { [Op.like]: '%@example.com' } } });
```

[← Guides](README.md)
