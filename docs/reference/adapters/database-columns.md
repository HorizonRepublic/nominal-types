# Database columns

The four database adapters, [mikro-orm](mikro-orm.md), [typeorm](typeorm.md), [drizzle](drizzle.md) and [sequelize](sequelize.md), share the rules on this page.

## Column per type

The column comes from the type. Each adapter has an option to choose your own.

| Type                                                                                                                 | MikroORM, TypeORM, Drizzle                           | Sequelize         |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------- |
| `Email`                                                                                                              | `varchar(254)`                                       | `STRING(254)`     |
| `HexColor`                                                                                                           | `varchar(9)`                                         | `STRING(9)`       |
| `Uuid`                                                                                                               | `uuid`                                               | `UUID`            |
| `CountryCode`                                                                                                        | `varchar(2)`                                         | `STRING(2)`       |
| `CurrencyCode`                                                                                                       | `varchar(3)`                                         | `STRING(3)`       |
| another string type with a length limit                                                                              | `varchar(<limit>)`                                   | `STRING(<limit>)` |
| `AnyString`, `Url`, `HttpUrl`, `LanguageTag`, `MediaType`, `Base64`, `Base64Url`, a string type without a limit      | `text`                                               | `TEXT`            |
| `Int8`, `Int16`, `Int32`, `Uint8`, `Uint16`                                                                          | `integer`                                            | `INTEGER`         |
| `Integer`, `PositiveInteger`, `NegativeInteger`, `NonNegativeInteger`, `NonPositiveInteger`, `Uint32`                | `bigint`                                             | `BIGINT`          |
| `AnyNumber`, `FiniteNumber`, `Float32`, `PositiveNumber`, `NegativeNumber`, `NonNegativeNumber`, `NonPositiveNumber` | `double precision` (MikroORM: the platform's double) | `DOUBLE`          |
| `Int64`                                                                                                              | `bigint`                                             | `BIGINT`          |
| `Uint64`                                                                                                             | `decimal(20, 0)`                                     | `DECIMAL(20)`     |
| `AnyBigInt` and the other big integer types                                                                          | `varchar(1000)`                                      | `STRING(1000)`    |
| `AnyBoolean`                                                                                                         | `boolean`                                            | `BOOLEAN`         |

Your own types get a column the same way, by what they accept. A number type that takes fractions, such as a price from 1 up, gets `double precision`. A type declared with `Nominal()` gets a column by what it accepts: `boolean` for `true`, a number column for `1`, else `text`.

A database without a kind of column uses its own. On SQLite, for example, MikroORM writes `text` for `Email` and `Uuid`, and `integer` for `AnyBoolean`. On MySQL, which has no `uuid`, choose `char(36)` for `Uuid`.

## Writes

- An instance is stored as its `toJSON()`: the text of an `Email`, the digits of an `Int64` as a string.
- With `serialize`, it is stored as what `serialize` returns, such as `email.canonical().value`.
- `null` and `undefined` are written as they are.
- Drizzle writes booleans as `1` and `0`, which every dialect takes.

## Reads

- A stored value becomes an instance, checked by the type.
- Numbers and booleans are read from text and from integers, as drivers return them: `'42'` gives `42`; `1`, `'t'` and `'true'` give `true`.
- A value the type rejects throws a `NominalError`, for example a row written before a rule changed.
- `trusted: true` builds instances without the check.
- `null` stays `null`.

The error names the type: `NominalError: nominal.Email: must be an email address (was a string of 3 characters)`.

## Options every adapter takes

| Option      | Type                 | Default                   | Description                                                             |
| ----------- | -------------------- | ------------------------- | ----------------------------------------------------------------------- |
| `serialize` | `(value) => unknown` | the instance's `toJSON()` | what is stored for an instance; also runs on values in query conditions |
| `trusted`   | `boolean`            | `false`                   | build instances from stored values without checking them                |

## Query values

MikroORM, TypeORM and Drizzle convert condition values the way they convert writes:

- an instance, or a plain value the type accepts, is stored the same way, through `serialize` too;
- a plain value the type rejects, such as a `like` pattern `'%@example.com'`, reaches the query as it is.

So with `serialize: (email) => email.canonical().value`, a lookup by `new Email('JANE.DOE@example.com')` finds `jane.doe@example.com`.

Sequelize doesn't run attribute setters on `where` values, and it refuses instances: `Error: Invalid value Email { value: 'jane.doe@example.com' }`. Compare with what is stored, such as `email.value`.

## Big integers and precision

Big integer types refuse a JavaScript number past 2^53 − 1, since it may have lost digits. Reading such a value throws rather than giving a wrong one, even with `trusted: true`:

```ts
import { toDrizzle } from '@horizon-republic/nominal-types/adapters/drizzle';
import { Int64 } from '@horizon-republic/nominal-types';

const balance = toDrizzle(Int64);

balance.fromDriver('9007199254740993'); // Int64 { value: 9007199254740993n }

balance.fromDriver(2 ** 53);
// throws NominalError: nominal.Int64: must be a bigint or an integer string,
//   since a number this large may have lost digits (was 9007199254740992)
```

| Database   | What happens                                                      | What to do                                                               |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| SQLite     | the driver returns integers as numbers, exact only up to 2^53 − 1 | enable the driver's `safeIntegers` for large `Int64` values              |
| SQLite     | numbers past 2^63 are kept as floating point                      | store large `Uint64` values as text, such as `{ column: 'varchar(20)' }` |
| PostgreSQL | `bigint` and `numeric` come back as text                          | nothing: they are read exactly                                           |

## See also

- [Built-in big integer types](../types/bigint.md)
- [How to store nominal types with MikroORM](../../guides/databases/mikro-orm.md)

[← Adapters](README.md) · [← Reference](../README.md)
