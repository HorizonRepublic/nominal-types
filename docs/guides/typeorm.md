# How to store nominal types with TypeORM

This guide shows how to keep nominal types in [TypeORM](https://typeorm.io) entities, so a property holds an `Email` rather than a `string`, and every value read from the database is checked.

The helper comes from a separate entry point, `@horizon-republic/nominal-types/adapters/typeorm`. You only need `typeorm` if you import it.

## Declaring a column

Pass `toTypeOrm(Type)` to `@Column()`:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { toTypeOrm } from '@horizon-republic/nominal-types/adapters/typeorm';
import { Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

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

`toTypeOrm()` takes any TypeORM column option as well, such as `nullable`, `unique`, or `type` and `length` to choose the column yourself.

## The column

The column comes from the type, as in [the MikroORM guide](mikro-orm.md#the-column): `varchar(254)` for `Email`, `uuid` for `Uuid`, `integer` or `bigint` by a number type's bounds, `boolean` for `AnyBoolean`.

## Reading and writing

- An instance is stored as its `toJSON()`, or as what `serialize` gives:

  ```ts
  @Column(toTypeOrm(Email, { serialize: (email) => email.canonical().value }))
  public email!: Email;
  ```

- A value read back becomes an instance, checked by the type. A value it refuses throws a `NominalError`; `trusted: true` builds instances without the check.
- `null` stays `null`.

## Querying

Find conditions take instances and plain values the type accepts, both stored the same way. A plain value the type refuses, such as a `Like` pattern, reaches the query as it is:

```ts
await users.findOneBy({ email: new Email('JANE.DOE@example.com') });
await users.findBy({ email: Like('%@example.com') });
```

[← Guides](README.md)
