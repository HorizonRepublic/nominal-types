# typeorm

Entry point: `@horizon-republic/nominal-types/adapters/typeorm`. Needs `typeorm` 0.3.13 or later, or 1.

| Export           | Kind     | Use it for                                             |
| ---------------- | -------- | ------------------------------------------------------ |
| `toTypeOrm()`    | function | the options of a `@Column()` that holds a nominal type |
| `TypeOrmOptions` | type     | the options of `toTypeOrm()`                           |

## toTypeOrm()

```ts
function toTypeOrm<Target extends AnyNominalType>(
  target: Target,
  options?: TypeOrmOptions<Target['prototype']>,
): ColumnOptions;
```

| Parameter | Type             | Description                       |
| --------- | ---------------- | --------------------------------- |
| `target`  | nominal type     | the type the column holds         |
| `options` | `TypeOrmOptions` | optional; see [Options](#options) |

Returns TypeORM `ColumnOptions`: the column `type` (and `length`, `precision`, `scale` where they apply) and a `transformer`. Pass them to `@Column()`. For example, `toTypeOrm(Email, { unique: true })` gives `{ type: 'varchar', length: 254, unique: true, transformer: { to, from } }`.

### Options

| Option                                         | Type                 | Default                                                    | Description                                                                      |
| ---------------------------------------------- | -------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `serialize`                                    | `(value) => unknown` | the instance's `toJSON()`                                  | what is stored; also runs on find values                                         |
| `trusted`                                      | `boolean`            | `false`                                                    | build instances from stored values without checking them                         |
| any TypeORM column option except `transformer` | `ColumnOptions`      | from the type, see [Database columns](database-columns.md) | such as `nullable`, `unique`, `type`, `length`; they win over the generated ones |

### Errors

Loading a row whose stored value the type rejects throws a `NominalError`.

## Example

```ts
import 'reflect-metadata';
import { Column, DataSource, Entity, Like, PrimaryColumn } from 'typeorm';
import { toTypeOrm } from '@horizon-republic/nominal-types/adapters/typeorm';
import { Email, Uuid } from '@horizon-republic/nominal-types';

@Entity()
class Customer {
  @PrimaryColumn() id!: number;
  @Column(toTypeOrm(Email, { serialize: (email) => email.canonical().value })) email!: Email;
  @Column(toTypeOrm(Uuid, { nullable: true })) referrer!: Uuid | null;
}

const source = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: [Customer], synchronize: true });
await source.initialize();
const customers = source.getRepository(Customer);
await customers.insert({ id: 1, email: new Email('Jane.Doe@Example.com'), referrer: null });

const found = await customers.findOneByOrFail({ email: new Email('JANE.DOE@example.com') });
found.email.value; // 'jane.doe@example.com'
await customers.countBy({ email: Like('%@example.com') }); // 1

await source.query("update customer set email = 'bad'");
await customers.findOneByOrFail({ id: 1 });
// throws NominalError: nominal.Email: must be an email address (was a string of 3 characters)
```

## See also

- [Database columns](database-columns.md)
- [How to store nominal types with TypeORM](../../guides/databases/typeorm.md)

[← Adapters](README.md) · [← Reference](../README.md)
