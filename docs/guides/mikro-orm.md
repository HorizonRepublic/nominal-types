# How to store nominal types with MikroORM

This guide shows how to keep nominal types in [MikroORM](https://mikro-orm.io) 7 entities, so a property holds an `Email` rather than a `string`, and every value read from the database is checked.

The helper comes from a separate entry point, `@horizon-republic/nominal-types/adapters/mikro-orm`. You only need `@mikro-orm/core` if you import it.

## Declaring a property

Give `toMikroOrm(Type)` as the property's type:

```ts
import { defineEntity } from '@mikro-orm/core';
import { toMikroOrm } from '@horizon-republic/nominal-types/adapters/mikro-orm';
import { Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

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

With decorators, it is `@Property({ type: toMikroOrm(Email) })`.

## The column

The column comes from the type:

| Type                                   | Column                                      |
| -------------------------------------- | ------------------------------------------- |
| `Email`                                | `varchar(254)`                              |
| `Uuid`                                 | `uuid`, or text where the database has none |
| a string type with a length limit      | `varchar` of that length                    |
| a string type without one              | `text`                                      |
| `Int8` to `Int32`                      | `integer`                                   |
| `Integer`, `PositiveInteger`, `Uint32` | `bigint`, since they go past 32 bits        |
| `Int64`                                | `bigint`                                    |
| `Uint64`                               | `decimal(20)`                               |
| `AnyBigInt`                            | `varchar(1000)`                             |
| other numbers                          | `double`                                    |
| `AnyBoolean`                           | `boolean`                                   |

To choose it yourself, pass `column`: `toMikroOrm(Email, { column: 'varchar(320)' })`.

## Reading and writing

- An instance is stored as its `toJSON()`, such as the text of an `Email`.
- A value read back becomes an instance, checked by the type. A value the type refuses, such as one written before a rule changed, throws a `NominalError`. Pass `trusted: true` to build instances without the check.
- `null` stays `null`.

## Storing a projection

Pass `serialize` to store something else, such as the canonical form of an email:

```ts
email: p.type(toMikroOrm(Email, { serialize: (email) => email.canonical().value })),
```

`serialize` also runs on values in query conditions, so a lookup canonicalises its input:

```ts
await em.findOne(User, { email: new Email('JANE.DOE@example.com') }); // finds jane.doe@example.com
```

## Querying

Conditions take instances, and plain values the type accepts. A plain value it refuses, such as a pattern for `$like`, reaches the query as it is:

```ts
await em.find(User, { email: { $like: '%@example.com' } });
```

## SQLite and big integers

SQLite loses precision on large integers in two places, and reading such a value back throws a `NominalError` rather than handing over a wrong one:

- Its driver returns integers as JavaScript numbers, exact only up to `2^53`. For larger `Int64` values, enable `safeIntegers` in the driver.
- It keeps numbers past `2^63` as floating point. For `Uint64` values that large, store them as text: `toMikroOrm(Uint64, { column: 'varchar(20)' })`.

PostgreSQL returns `bigint` and `numeric` as text, which is read exactly.

[← Guides](README.md)
