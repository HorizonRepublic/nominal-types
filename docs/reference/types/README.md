# Built-in types

The types the package ships, as a tree. Each type is a [subtype](../glossary.md) of the type above it. An instance fits wherever a type above it is expected, not the other way round. Every `Email` is an `AnyString`, but not every `AnyString` is an `Email`.

The built-in types are optional. Any type can be declared from scratch with [`Nominal()`](../declaring.md#nominal).

```text
AnyString                     any string
├── Email
├── Uuid
├── Url
│   └── HttpUrl
├── CountryCode               ISO 3166-1, such as US
├── CurrencyCode              ISO 4217, such as EUR
├── LanguageTag               BCP 47, such as en-US
├── MediaType                 text/html; charset=utf-8
├── HexColor                  #1e90ff
├── Base64                    bytes as text, + and / with = padding
└── Base64Url                 bytes as text, - and _ without padding

AnyNumber                     any number, NaN and the infinities included
└── FiniteNumber              any number but NaN and the infinities
    ├── PositiveNumber            > 0
    ├── NegativeNumber            < 0
    ├── NonNegativeNumber         ≥ 0
    ├── NonPositiveNumber         ≤ 0
    ├── Float32                   exact as a 32-bit float
    └── Integer                   a safe integer
        ├── PositiveInteger           ≥ 1
        ├── NegativeInteger           ≤ -1
        ├── NonNegativeInteger        ≥ 0
        ├── NonPositiveInteger        ≤ 0
        ├── Int8, Int16, Int32
        └── Uint8, Uint16, Uint32

AnyBigInt                     any integer, as a bigint
├── PositiveBigInt                ≥ 1
├── NegativeBigInt                ≤ -1
├── NonNegativeBigInt             ≥ 0
├── NonPositiveBigInt             ≤ 0
├── Int64
└── Uint64

AnyBoolean                    true or false
```

| Page                      | Types                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Strings](string.md)      | `AnyString`, `Email`, `Uuid`, `Url`, `HttpUrl`, `CountryCode`, `CurrencyCode`, `LanguageTag`, `MediaType`, `HexColor`, `Base64`, `Base64Url` |
| [Numbers](number.md)      | `AnyNumber` and the 17 types under it                                                                                                        |
| [Big integers](bigint.md) | `AnyBigInt`, its sign types, `Int64`, `Uint64`                                                                                               |
| [Booleans](boolean.md)    | `AnyBoolean`                                                                                                                                 |

## Which built-in type do I pick?

| Value                                | Type                                                    | Why                                             |
| ------------------------------------ | ------------------------------------------------------- | ----------------------------------------------- |
| an email address                     | `Email`                                                 | checks the address and hides it in messages     |
| an id made as a UUID                 | `Uuid`                                                  | any version, any case                           |
| a link to a web page                 | `HttpUrl`                                               | `http` and `https` only; `Url` takes any scheme |
| a country                            | `CountryCode`                                           | ISO codes such as `US`, upper case only         |
| a currency                           | `CurrencyCode`                                          | ISO codes such as `EUR`, with `minorUnits`      |
| a language or locale                 | `LanguageTag`                                           | tags such as `en-US`, any case                  |
| a `Content-Type`, the type of a file | `MediaType`                                             | `essence` and `parameters` read it for you      |
| a color from a color picker          | `HexColor`                                              | `#` required; channels as numbers               |
| a file or a key inside JSON          | `Base64`                                                | `toBytes()` gives the bytes                     |
| a part of a token or of a URL        | `Base64Url`                                             | `-` and `_`, no `=` padding                     |
| free text                            | `AnyString`                                             | any string, `''` included                       |
| a count of items, such as a quantity | `PositiveInteger`                                       | 1 and up                                        |
| an amount in cents, an index         | `NonNegativeInteger`                                    | 0 and up                                        |
| a network port                       | `Uint16`                                                | 0 to 65,535                                     |
| a database `integer` column          | `Int32`                                                 | the range of a 32-bit integer                   |
| a database `bigint` id               | `Int64`                                                 | the range of a 64-bit integer, as a `bigint`    |
| a price, a weight, a temperature     | `FiniteNumber`, or a sign type such as `PositiveNumber` | any number JSON can carry                       |
| a flag                               | `AnyBoolean`                                            | `true` or `false`                               |

Declare your own type under the one you pick, so it carries its own meaning: `class Quantity extends PositiveInteger.subtype('shop.Quantity') {}`.

## Common to every built-in type

- Rules run from the root down and stop at the first failure. The error names the type and gives that rule's message.
- Values are never converted. `AnyBigInt` and the types under it are the exception: they also take a decimal string or a safe integer. To read a number or boolean from text, use [`fromString()`](../schemas.md#fromstring).
- A long, crafted input can't make a built-in check slow.
- The JSON Schema has the type name as `title`, such as `nominal.Email`. See [JSON Schema](../json-schema.md).

[← Reference](../README.md)
