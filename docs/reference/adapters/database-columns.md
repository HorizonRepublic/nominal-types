# Database columns

The four database adapters, [mikro-orm](mikro-orm.md), [typeorm](typeorm.md), [drizzle](drizzle.md) and [sequelize](sequelize.md), share the rules on this page.

## Column per type

The column comes from the type. Each adapter has an option to choose your own.

| Type                                                                                                                                                                                                                                                                                                                | MikroORM, TypeORM, Drizzle                           | Sequelize         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------- |
| `Email`                                                                                                                                                                                                                                                                                                             | `varchar(254)`                                       | `STRING(254)`     |
| `HexColor`                                                                                                                                                                                                                                                                                                          | `varchar(9)`                                         | `STRING(9)`       |
| `CountryCode`                                                                                                                                                                                                                                                                                                       | `varchar(2)`                                         | `STRING(2)`       |
| `CurrencyCode`                                                                                                                                                                                                                                                                                                      | `varchar(3)`                                         | `STRING(3)`       |
| `Uuid`, `UuidV4`, `UuidV7`                                                                                                                                                                                                                                                                                          | `uuid`                                               | `UUID`            |
| another string type with a length limit: `Ulid` 26, `TypeId` 90, `DecimalString` 100, `ObjectId` 24, `SemVer` 256, `Hostname` and `DomainName` 253, `IpAddress` and `Ipv6Address` 45, `Ipv4Address` 15, `IpPrefix` and `Ipv6Prefix` 49, `Ipv4Prefix` 18, `MacAddress` 17, `Isbn` 13, `Issn` 9, `Gtin` 14, `Isin` 12 | `varchar(<limit>)`                                   | `STRING(<limit>)` |
| `AnyString`, `NonEmptyString`, `NonBlankString`, `Url`, `HttpUrl`, `LanguageTag`, `MediaType`, `Base64`, `Base64Url`, a string type without a limit                                                                                                                                                                 | `text`                                               | `TEXT`            |
| `Int8`, `Int16`, `Int32`, `Uint8`, `Uint16`, `Port`                                                                                                                                                                                                                                                                 | `integer`                                            | `INTEGER`         |
| `Integer`, `PositiveInteger`, `NegativeInteger`, `NonNegativeInteger`, `NonPositiveInteger`, `Uint32`                                                                                                                                                                                                               | `bigint`                                             | `BIGINT`          |
| `AnyNumber`, `FiniteNumber`, `Float32`, `PositiveNumber`, `NegativeNumber`, `NonNegativeNumber`, `NonPositiveNumber`, `Latitude`, `Longitude`                                                                                                                                                                       | `double precision` (MikroORM: the platform's double) | `DOUBLE`          |
| `Int64`                                                                                                                                                                                                                                                                                                             | `bigint`                                             | `BIGINT`          |
| `Uint64`                                                                                                                                                                                                                                                                                                            | `decimal(20, 0)`                                     | `DECIMAL(20)`     |
| `AnyBigInt` and the other big integer types                                                                                                                                                                                                                                                                         | `varchar(1000)`                                      | `STRING(1000)`    |
| `AnyBoolean`                                                                                                                                                                                                                                                                                                        | `boolean`                                            | `BOOLEAN`         |
| `Instant`                                                                                                                                                                                                                                                                                                           | `timestamptz` (MikroORM: the platform's date-time)   | `DATE`            |
| `PlainDate`                                                                                                                                                                                                                                                                                                         | `date`                                               | `DATEONLY`        |
| `PlainTime`                                                                                                                                                                                                                                                                                                         | `time` (MikroORM: `time(6)`)                         | `TIME`            |
| `PlainDateTime`                                                                                                                                                                                                                                                                                                     | `timestamp` (MikroORM: the date-time without a zone) | `TIMESTAMP`       |

Your own types get a column the same way, by what they accept. A number type that takes fractions, such as a price from 1 up, gets `double precision`. A type declared with `Nominal()` gets a column by what it accepts: `boolean` for `true`, a number column for `1`, else `text`.

`Money` holds two fields, so it doesn't fit in one column. Store its `amount` as a `DecimalString` column and its `currency` as a `CurrencyCode` column. [How to handle money](../../guides/core/handle-money.md#store-an-amount) shows how.

PostgreSQL has columns made for addresses. To use one, choose it yourself:

| Type                                      | PostgreSQL column | For example                                     |
| ----------------------------------------- | ----------------- | ----------------------------------------------- |
| `IpAddress`, `Ipv4Address`, `Ipv6Address` | `inet`            | `toTypeOrm(IpAddress, { type: 'inet' })`        |
| `IpPrefix`, `Ipv4Prefix`, `Ipv6Prefix`    | `cidr`            | `toDrizzle(IpPrefix, { column: 'cidr' })`       |
| `MacAddress`                              | `macaddr`         | `toMikroOrm(MacAddress, { column: 'macaddr' })` |

PostgreSQL returns these values in its own form: `2001:DB8:0:0:0:0:0:1` comes back as `2001:db8::1`, and `00-00-5E-00-53-01` as `00:00:5e:00:53:01`. The types accept that form, and `equals()` still holds between the two.

A database without a kind of column uses its own. On SQLite, for example, MikroORM writes `text` for `Email` and `Uuid`, and `integer` for `AnyBoolean`. On MySQL, which has no `uuid`, choose `char(36)` for `Uuid`.

## Writes

- An instance is stored as its `toJSON()`: the text of an `Email`, the digits of an `Int64` as a string.
- With `serialize`, it is stored as what `serialize` returns, such as `email.canonical().value`.
- A plain value the type accepts is stored as its instance would be.
- A plain value the type rejects is written as it is. Query conditions go through the same step, which keeps patterns such as `'%@example.com'` working.
- `null` and `undefined` are written as they are.
- Drizzle writes booleans as `1` and `0`, which every dialect takes.

So the database can hold values the type refuses. They come from a plain value cast past the compiler, raw SQL, a migration or another app. Reading such a row throws.

## Reads

- A stored value becomes an instance, checked by the type.
- Numbers and booleans are read from text and from integers, as drivers return them: `'42'` gives `42`; `1`, `'t'` and `'true'` give `true`.
- A value the type rejects throws a `NominalError`, for example a row written before a rule changed.
- `trusted: true` builds instances without the check. A bad stored value then becomes a bad instance: its getters give wrong answers, and nothing checks it again. Use it only for a column that nothing else writes to.
- `null` stays `null`.

The error names the type: `NominalError: nominal.Email: must be an email address (was a string of 3 characters)`.

With the Drizzle adapter:

```ts
import { Email } from '@horizon-republic/nominal-types';
import { toDrizzle } from '@horizon-republic/nominal-types/adapters/drizzle';

const email = toDrizzle(Email);
const trusted = toDrizzle(Email, { trusted: true });

email.toDriver('not an address' as unknown as Email); // 'not an address', written as it is
email.fromDriver('not an address'); // throws NominalError: nominal.Email: must be an email address (was a string of 14 characters)
trusted.fromDriver('not an address').domain; // 'not an address'
```

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

## Dates and times

The [date and time types](../types/temporal.md) are stored as the text `toJSON()` writes, such as `2024-05-01T09:30:00Z`.

Drivers read these columns in different ways:

| Driver returns          | `Instant`                | `PlainDate`, `PlainTime`, `PlainDateTime` |
| ----------------------- | ------------------------ | ----------------------------------------- |
| text in the type's form | read                     | read                                      |
| a `Date`                | read, to the millisecond | refused with a `NominalError`             |

A `Date` for a `date` or `timestamp` column stands for local midnight or a local time. The time zone of the process would shift it, so it is refused. Make the driver return text instead. With node-postgres:

```ts
import pg from 'pg';

pg.types.setTypeParser(1082, (text: string) => text); // date
pg.types.setTypeParser(1114, (text: string) => text.replace(' ', 'T')); // timestamp
```

TypeORM turns `timestamp` and `datetime` columns into a `Date` itself. Store a `PlainDateTime` in a text column there: `toTypeOrm(PlainDateTime, { type: 'varchar', length: 29 })`.

On SQLite, TypeORM has no `timestamptz` and `timestamp`. Use `{ type: 'datetime' }` for an `Instant`.

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
