# mikro-orm

Entry point: `@horizon-republic/nominal-types/adapters/mikro-orm`. Needs `@mikro-orm/core` 7.

| Export            | Kind     | Use it for                                   |
| ----------------- | -------- | -------------------------------------------- |
| `toMikroOrm()`    | function | an entity property that holds a nominal type |
| `MikroOrmOptions` | type     | the options of `toMikroOrm()`                |
| `MikroOrmType`    | type     | the type class `toMikroOrm()` returns        |

## toMikroOrm()

```ts
function toMikroOrm<Target extends AnyNominalType>(
  target: Target,
  options?: MikroOrmOptions<Target['prototype']>,
): MikroOrmType<Target>;
```

| Parameter | Type              | Description                       |
| --------- | ----------------- | --------------------------------- |
| `target`  | nominal type      | the type the property holds       |
| `options` | `MikroOrmOptions` | optional; see [Options](#options) |

Returns a MikroORM `Type` class named after the type, such as `nominal.EmailType`. Use it as the property's type:

- with `defineEntity`: `p.type(toMikroOrm(Email))`, and `.nullable()` for `null`;
- with decorators: `@Property({ type: toMikroOrm(Email) })`.

### Options

| Option      | Type                 | Default                                                    | Description                                              |
| ----------- | -------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| `column`    | `string`             | from the type, see [Database columns](database-columns.md) | the SQL type, such as `'varchar(320)'`                   |
| `serialize` | `(value) => unknown` | the instance's `toJSON()`                                  | what is stored; also runs on query values                |
| `trusted`   | `boolean`            | `false`                                                    | build instances from stored values without checking them |

### Errors

Loading an entity whose stored value the type rejects throws a `NominalError`. MikroORM also prints a `JIT runtime error` with the same message.

## Example

```ts
import { defineEntity, MikroORM } from '@mikro-orm/sqlite';
import { toMikroOrm } from '@horizon-republic/nominal-types/adapters/mikro-orm';
import { Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

const Customer = defineEntity({
  name: 'Customer',
  properties: (p) => ({
    id: p.integer().primary(),
    email: p.type(toMikroOrm(Email, { serialize: (email) => email.canonical().value })),
    referrer: p.type(toMikroOrm(Uuid)).nullable(),
    visits: p.type(toMikroOrm(PositiveInteger)),
  }),
});

const orm = await MikroORM.init({ entities: [Customer], dbName: ':memory:' });
await orm.schema.create();
const em = orm.em.fork();
em.create(Customer, { id: 1, email: new Email('Jane.Doe@Example.com'), referrer: null, visits: new PositiveInteger(3) });
await em.flush();

const found = await orm.em.fork().findOneOrFail(Customer, { email: new Email('JANE.DOE@example.com') });
found.email.value; // 'jane.doe@example.com'
found.referrer; // null

await orm.em.getConnection().execute("update `customer` set `email` = 'bad'");
await orm.em.fork().findOneOrFail(Customer, { id: 1 });
// throws NominalError: nominal.Email: must be an email address (was a string of 3 characters)
```

## See also

- [Database columns](database-columns.md)
- [How to store nominal types with MikroORM](../../guides/databases/mikro-orm.md)

[← Adapters](README.md) · [← Reference](../README.md)
