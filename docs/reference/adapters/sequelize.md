# sequelize

Entry point: `@horizon-republic/nominal-types/adapters/sequelize`. Needs `sequelize` 6.

| Export             | Kind     | Use it for                                  |
| ------------------ | -------- | ------------------------------------------- |
| `toSequelize()`    | function | a model attribute that holds a nominal type |
| `SequelizeOptions` | type     | the options of `toSequelize()`              |

## toSequelize()

```ts
function toSequelize<Target extends AnyNominalType>(
  target: Target,
  options?: SequelizeOptions<Target['prototype']>,
): ModelAttributeColumnOptions;
```

| Parameter | Type               | Description                       |
| --------- | ------------------ | --------------------------------- |
| `target`  | nominal type       | the type the attribute holds      |
| `options` | `SequelizeOptions` | optional; see [Options](#options) |

Returns Sequelize attribute options: a `type`, a getter and a setter. Pass them to `Model.init()`.

- Setting the attribute stores the instance's `toJSON()`, or what `serialize` gives.
- Reading the attribute gives an instance, checked unless `trusted`.
- `JSON.stringify(model)` writes the stored values. `model.toJSON()` returns the instances.

### Options

| Option                                            | Type                          | Default                                                    | Description                                              |
| ------------------------------------------------- | ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| `serialize`                                       | `(value) => unknown`          | the instance's `toJSON()`                                  | what is stored                                           |
| `trusted`                                         | `boolean`                     | `false`                                                    | build instances from stored values without checking them |
| `type`                                            | Sequelize `DataType`          | from the type, see [Database columns](database-columns.md) | the column type                                          |
| any other attribute option except `get` and `set` | `ModelAttributeColumnOptions` | Sequelize's defaults                                       | such as `allowNull`, `unique`, `field`                   |

### Queries

Sequelize runs no setters on `where` values, so `serialize` doesn't apply there. An instance in `where` throws `Error: Invalid value Email { value: 'jane.doe@example.com' }`. Compare with what is stored, such as `{ where: { email: email.value } }` or `{ where: { email: { [Op.like]: '%@example.com' } } }`.

### Errors

A stored value the type rejects throws a `NominalError` when the attribute is read, not when the row is loaded.

## Example

```ts
import { Model, Sequelize } from 'sequelize';
import { toSequelize } from '@horizon-republic/nominal-types/adapters/sequelize';
import { Email, Uuid } from '@horizon-republic/nominal-types';

class Customer extends Model {
  declare email: Email;
  declare referrer: Uuid | null;
}

const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
Customer.init(
  {
    email: toSequelize(Email, { serialize: (email) => email.canonical().value, unique: true }),
    referrer: toSequelize(Uuid, { allowNull: true }),
  },
  { sequelize },
);
await sequelize.sync();
await Customer.create({ email: new Email('Jane.Doe@Example.com'), referrer: null });

const found = await Customer.findOne({ where: { email: 'jane.doe@example.com' } });
found?.email; // Email { value: 'jane.doe@example.com' }

await sequelize.query("update Customers set email = 'bad'");
const broken = await Customer.findOne(); // no error yet
broken?.email;
// throws NominalError: nominal.Email: must be an email address (was a string of 3 characters)
```

## See also

- [Database columns](database-columns.md)
- [How to store nominal types with Sequelize](../../guides/databases/sequelize.md)

[← Adapters](README.md) · [← Reference](../README.md)
