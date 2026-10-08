# Built-in types

The types the package ships, as a tree. Each type is a [subtype](../glossary.md) of the type above it. An instance fits wherever a type above it is expected, not the other way round. Every `Email` is an `AnyString`, but not every `AnyString` is an `Email`.

A type marked `+` also [implies](../glossary.md) types in other branches: every value it accepts passes them, so its instances fit where they are expected. `PositiveInteger` fits where `PositiveNumber` is expected. [Numbers](number.md#implied-types) and [Big integers](bigint.md#implied-types) list the implied types.

The built-in types are optional. Any type can be declared from scratch with [`Nominal()`](../declaring.md#nominal).

```text
AnyString                     any string
├── NonEmptyString            at least one character
│   └── NonBlankString            not only white space
├── Email
├── E164PhoneNumber           a phone number, such as +14155552671
├── Uuid                      any version
│   ├── UuidV4                    random
│   └── UuidV7                    starts with the time
├── Ulid
├── TypeId                    an id with its kind, such as user_01h455…
├── ObjectId                  a MongoDB id
├── SemVer                    a version such as 1.4.2
├── Url
│   └── HttpUrl
├── CountryCode               ISO 3166-1, such as US
├── CurrencyCode              ISO 4217, such as EUR
├── DecimalString             an exact number as text, such as 12.34
├── LanguageTag               BCP 47, such as en-US
├── MediaType                 text/html; charset=utf-8
├── HexColor                  #1e90ff
├── Base64                    bytes as text, + and / with = padding
├── Base64Url                 bytes as text, - and _ without padding
├── Jwt                       a token, such as an access token
├── Hostname                  localhost, api.example.com
│   └── DomainName                with a top-level domain
├── IpAddress                 IPv4 or IPv6
│   ├── Ipv4Address
│   └── Ipv6Address
├── IpPrefix                  a network, such as 10.0.0.0/8
│   ├── Ipv4Prefix
│   └── Ipv6Prefix
├── MacAddress
├── Isbn                      a book, such as 9780306406157
├── Issn                      a journal, such as 0378-5955
├── Gtin                      a bar code number, EAN or UPC
├── Isin                      a security, such as US0378331005
├── Iban                      a bank account, such as GB82WEST1234…
└── Bic                       a bank, such as DEUTDEFF

AnyNumber                     any number, NaN and the infinities included
└── FiniteNumber              any number but NaN and the infinities
    ├── PositiveNumber +          > 0
    ├── NegativeNumber +          < 0
    ├── NonNegativeNumber         ≥ 0
    ├── NonPositiveNumber         ≤ 0
    ├── Float32                   exact as a 32-bit float
    ├── Latitude                  -90 to 90
    ├── Longitude                 -180 to 180
    └── Integer                   a safe integer
        ├── PositiveInteger +         ≥ 1
        ├── NegativeInteger +         ≤ -1
        ├── NonNegativeInteger +      ≥ 0
        ├── NonPositiveInteger +      ≤ 0
        ├── Int8 +, Int16 +, Int32
        ├── Uint8 +
        ├── Uint16 +                  0 to 65,535
        │   └── Port +                    1 to 65,535
        └── Uint32 +

AnyBigInt                     any integer, as a bigint
├── PositiveBigInt +              ≥ 1
├── NegativeBigInt +              ≤ -1
├── NonNegativeBigInt             ≥ 0
├── NonPositiveBigInt             ≤ 0
├── Int64
└── Uint64 +

AnyBoolean                    true or false

Money                         an amount and a currency, such as 12.34 EUR
```

The date and time types come from `@horizon-republic/nominal-types/temporal`. `TimeZoneId` sits under `AnyString`; each of the others is a root of its own:

```text
Instant                       a moment, written with an offset
PlainDate                     a calendar date
PlainTime                     a time of day
PlainDateTime                 a date and time without an offset
ZonedDateTime                 a date and time in a time zone
Duration                      a length of time, such as P1DT12H

AnyString
└── TimeZoneId                a time zone name, such as Europe/Paris
```

| Page                           | Types                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| [Strings](string.md)           | `AnyString` and the 37 types under it                                                           |
| [Numbers](number.md)           | `AnyNumber` and the 20 types under it                                                           |
| [Big integers](bigint.md)      | `AnyBigInt`, its sign types, `Int64`, `Uint64`                                                  |
| [Booleans](boolean.md)         | `AnyBoolean`                                                                                    |
| [Money](money.md)              | `Money`                                                                                         |
| [Dates and times](temporal.md) | `Instant`, `PlainDate`, `PlainTime`, `PlainDateTime`, `ZonedDateTime`, `Duration`, `TimeZoneId` |

## Which built-in type do I pick?

| Value                                       | Type                                                            | Why                                             |
| ------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| an email address                            | `Email`                                                         | checks the address and hides it in messages     |
| a phone number                              | `E164PhoneNumber`                                               | `+` and digits; hidden in messages              |
| an id made as a UUID                        | `Uuid`                                                          | any version, any case                           |
| a UUID made by `crypto.randomUUID()`        | `UuidV4`                                                        | version 4 only                                  |
| a UUID that sorts by time                   | `UuidV7`                                                        | version 7 only, with its `timestamp`            |
| an id made as a ULID                        | `Ulid`                                                          | any case, with its `timestamp`                  |
| an id that names its kind, such as `user_…` | `TypeId`, with `TypeId.withPrefix()` for one kind               | the TypeID format; `generate()` makes new ids   |
| a MongoDB `_id`                             | `ObjectId`                                                      | 24 hex digits, any case                         |
| a version of a package or an API            | `SemVer`                                                        | sorts with `compare()`                          |
| a link to a web page                        | `HttpUrl`                                                       | `http` and `https` only; `Url` takes any scheme |
| a country                                   | `CountryCode`                                                   | ISO codes such as `US`, upper case only         |
| a currency                                  | `CurrencyCode`                                                  | ISO codes such as `EUR`, with `minorUnits`      |
| an amount of money, such as a price         | `Money`                                                         | exact, with the currency's digits               |
| an exact number that isn't money, a rate    | `DecimalString`                                                 | text, so no digit is lost                       |
| a language or locale                        | `LanguageTag`                                                   | tags such as `en-US`, any case                  |
| a `Content-Type`, the type of a file        | `MediaType`                                                     | `essence` and `parameters` read it for you      |
| a color from a color picker                 | `HexColor`                                                      | `#` required; channels as numbers               |
| a file or a key inside JSON                 | `Base64`                                                        | `toBytes()` gives the bytes                     |
| a part of a token or of a URL               | `Base64Url`                                                     | `-` and `_`, no `=` padding                     |
| an access token, before you verify it       | `Jwt`                                                           | checks the form only, never the signature       |
| a server name, such as a database host      | `Hostname`                                                      | `localhost` too; no URL, port or trailing dot   |
| a domain a user owns, such as `example.com` | `DomainName`                                                    | needs a top-level domain                        |
| a client or server IP address               | `IpAddress`, or `Ipv4Address` and `Ipv6Address` for one version | `isGlobal` tells internal addresses apart       |
| a network for an allow list                 | `IpPrefix`                                                      | `contains()` checks an address                  |
| a device's hardware address                 | `MacAddress`                                                    | `:` or `-` between the pairs                    |
| a book                                      | `Isbn`                                                          | ISBN-10 or ISBN-13, check digit checked         |
| a journal or a magazine                     | `Issn`                                                          | check digit checked                             |
| the number under a product's bar code       | `Gtin`                                                          | EAN and UPC numbers, check digit checked        |
| a share or a bond                           | `Isin`                                                          | check digit checked, upper case only            |
| a bank account                              | `Iban`                                                          | country rules and check digits checked          |
| a bank, for a transfer abroad               | `Bic`                                                           | the SWIFT code, 8 or 11 characters              |
| a required name or title                    | `NonBlankString`                                                | not `''` and not only spaces                    |
| a required text that may be spaces          | `NonEmptyString`                                                | not `''`                                        |
| free text                                   | `AnyString`                                                     | any string, `''` included                       |
| a count of items, such as a quantity        | `PositiveInteger`                                               | 1 and up                                        |
| an amount in cents, an index                | `NonNegativeInteger`                                            | 0 and up                                        |
| a network port                              | `Port`                                                          | 1 to 65,535; `Uint16` also takes 0              |
| a position on a map                         | `Latitude` and `Longitude`                                      | -90 to 90 and -180 to 180                       |
| a database `integer` column                 | `Int32`                                                         | the range of a 32-bit integer                   |
| a database `bigint` id                      | `Int64`                                                         | the range of a 64-bit integer, as a `bigint`    |
| a weight, a temperature                     | `FiniteNumber`, or a sign type such as `PositiveNumber`         | any number JSON can carry                       |
| a flag                                      | `AnyBoolean`                                                    | `true` or `false`                               |
| a moment, such as `paidAt`                  | `Instant`                                                       | an offset is required, so the moment is exact   |
| a birthday, a due date                      | `PlainDate`                                                     | a real calendar day, no time and no zone        |
| an opening hour                             | `PlainTime`                                                     | a time of day, no zone                          |
| a meeting in local time                     | `PlainDateTime`                                                 | a date and time, no zone                        |
| a flight that leaves at local time          | `ZonedDateTime`                                                 | a date and time with its zone and offset        |
| a timeout, a billing period                 | `Duration`                                                      | `P1DT12H`, compared unit by unit                |
| a user's time zone                          | `TimeZoneId`                                                    | a zone name the runtime knows, not an offset    |

Declare your own type under the one you pick, so it carries its own meaning: `class Quantity extends PositiveInteger.subtype('shop.Quantity') {}`.

## Common to every built-in type

- Rules run from the root down and stop at the first failure. The error names the type and gives that rule's message.
- Values are never converted. `AnyBigInt` and the types under it are an exception: they also take a decimal string or a safe integer. The date and time types are another: they turn text into a Temporal object. To read a number or boolean from text, use [`fromString()`](../schemas.md#fromstring).
- A long, crafted input can't make a built-in check slow.
- The JSON Schema has the type name as `title`, such as `nominal.Email`. See [JSON Schema](../json-schema.md).
- A method that returns a changed copy, such as `canonical()` or `withTag()`, returns the class it was called on. A `canonical()` of a subtype of `Email` is that subtype. If the subtype's rules refuse the new value, the method throws `NominalError`.

[← Reference](../README.md)
