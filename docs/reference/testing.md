# Testing

Generators of test values for every nominal type and schema, built on [fast-check](https://fast-check.dev). How to use them: [How to generate test data](../guides/core/generate-test-data.md).

## Entry point

```ts
import { arbitraryOf, invalidArbitraryOf, sampleOf } from '@horizon-republic/nominal-types/testing';
```

| Peer package | Versions |
| ------------ | -------- |
| `fast-check` | ^4.6.0   |

fast-check is an optional [peer dependency](glossary.md): install it as a dev dependency. Nothing else in the package loads it.

## Functions

A target is a nominal type, or a schema built by `n.of()`, `n.object()`, `n.record()`, `n.tuple()` or `n.union()`, including the results of `array()`, `optional()`, `nullable()`, `fromString()`, `fromEnv()`, `partial()`, `required()`, `pick()`, `omit()`, `extend()` and `strict()`.

| Function                                 | Returns                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| `arbitraryOf(target, options?)`          | a fast-check `Arbitrary` of values the target accepts |
| `invalidArbitraryOf(target, options?)`   | a fast-check `Arbitrary` of values the target refuses |
| `sampleOf(target, count = 10, options?)` | an array of `count` values the target accepts         |

Every value `arbitraryOf()` makes passes `accepts()` and `parse()` of the target.

## Options

| Option      | Taken by                      | Meaning                                                                                                                  |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `as`        | `arbitraryOf()`, `sampleOf()` | `'inputs'` (default): plain values, such as strings for `Email`. `'instances'`: what `parse()` gives for them.           |
| `overrides` | all three                     | a `Map` from a nominal type or a schema to an arbitrary of your own, used wherever the target holds that type or schema. |
| `seed`      | `sampleOf()`                  | a number; the same seed gives the same values on every run.                                                              |

A value from an override is still checked: values the type or schema refuses are dropped.

## Values of built-in types

Each built-in type has its own generator. It makes values from the whole range of the type, edges included:

| Types                                                | What the values include                                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Number types                                         | the lowest and highest value, the numbers next to an excluded bound, `-0` where the rule takes it                                         |
| `AnyNumber`                                          | `NaN`, `Infinity` and `-Infinity` as well                                                                                                 |
| Big integer types                                    | bigints, decimal text and safe integers, out to the bounds and to text of 1000 characters                                                 |
| `Email`                                              | dots, plus tags, `xn--` top-level domains, 6 and 254 characters, 64 characters before the `@`                                             |
| `Hostname`, `DomainName`                             | labels of 63 characters, names of 253 characters, `xn--` labels that decode, either case                                                  |
| `Url`, `HttpUrl`                                     | many schemes, hosts by name, IPv4 and IPv6, ports, paths, queries and fragments, `HTTP` in any case                                       |
| `IpAddress`, `Ipv4Address`, `Ipv6Address`            | every IPv6 text form, `::` and an IPv4 part included                                                                                      |
| `IpPrefix`, `Ipv4Prefix`, `Ipv6Prefix`               | every prefix length, host bits zero                                                                                                       |
| `Uuid`, `UuidV4`, `UuidV7`                           | every version, either case, the nil and max UUIDs                                                                                         |
| `Isbn`, `Issn`, `Gtin`, `Isin`                       | every length, valid check digits, `X` where it is allowed                                                                                 |
| `CountryCode`, `CurrencyCode`                        | every code in the list                                                                                                                    |
| `E164PhoneNumber`                                    | every country calling code, numbers up to 15 digits                                                                                       |
| `Iban`                                               | every country of the registry with its BBAN shape, valid check digits                                                                     |
| `Bic`                                                | 8 and 11 characters, every country `CountryCode` accepts                                                                                  |
| `Jwt`                                                | many `alg` values, `none` with an empty signature, `exp`, `nbf` and `iat` as whole and fractional numbers, tokens up to 8,192 characters  |
| `LanguageTag`, `SemVer`, `MediaType`                 | every part of the grammar, such as extensions, prereleases and parameters                                                                 |
| `Base64`, `Base64Url`                                | the text of byte strings of 0 to 48 bytes                                                                                                 |
| `DecimalString`                                      | either sign, `0`, fractions, text of 100 characters                                                                                       |
| `TypeId`                                             | ids with and without a prefix, prefixes of 63 characters; a type from `TypeId.withPrefix()` gets its prefix                               |
| `Money`                                              | every currency, with no more digits after the point than its minor units; up to 8 for a currency without them                             |
| `Instant`, `PlainDate`, `PlainTime`, `PlainDateTime` | text from year 0000 to 9999, and Temporal objects when the runtime has `Temporal`                                                         |
| `ZonedDateTime`                                      | the offset each zone has at that moment, moments next to a change of daylight saving time, zone names in lower case, and Temporal objects |
| `Duration`                                           | every unit, weeks alone, fractions of a second, and Temporal objects                                                                      |
| `TimeZoneId`                                         | every zone the runtime lists, `UTC` and older names, in any case                                                                          |

Other string types are made from their pattern, such as `HexColor`, `MacAddress`, `ObjectId` and `Ulid`.

## Values of your own types

A type of your own is made from the first of these that works, from the type itself up to its root:

1. a generator in `overrides`;
2. the schema it is declared on, such as an `n.object()`;
3. a built-in type it is declared under;
4. its pattern, read by fast-check's `stringMatching()`;
5. its `n.oneOf()` values;
6. its JSON Schema: `pattern`, `enum`, `const`, `type`, bounds, lengths, `format`, `items` and `properties`;
7. the `examples` of its JSON Schema.

A candidate is kept when the type accepts at least a quarter of a sample of its values. Every value is checked with the type's `accepts()`.

A pattern fast-check can't read, such as one with a lookahead, is skipped: the type is made from the type above it.

## Values of schemas

| Schema                      | Values                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `array()`                   | from `min` to `max` items, both ends included; with `unique`, no two items equal                            |
| `optional()`, `nullable()`  | `undefined` or `null` now and then                                                                          |
| `fromString()`, `fromEnv()` | the values as text now and then, such as `'8080'`, and the values themselves                                |
| `n.object()`                | optional fields left out now and then; values that keep every constraint                                    |
| `n.union()`                 | every variant, with its tag as the first field                                                              |
| `n.record()`                | from `min()` to `max()` keys the key schema accepts; with listed keys, every key, or some after `partial()` |
| `n.tuple()`                 | an item for each position, optional trailing items left out now and then, and any number of rest items      |

A field of another Standard Schema library is made from its JSON Schema and checked by the library.

## Invalid values

`invalidArbitraryOf()` changes valid values by kind:

| Kind of value | Changes                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| string        | a character added or removed, upper or lower case, spaces around it, cut in half, repeated, padded to 300 characters, empty |
| number        | one more or less, sign flipped, a half added, doubled, `NaN`, infinities, the number as text                                |
| bigint        | one more or less, sign flipped, text that is not an integer                                                                 |
| array         | an item removed, added or changed                                                                                           |
| object        | a field left out, changed, or an unknown field added                                                                        |

Values of the wrong kind come in between: `null`, `undefined`, booleans, numbers, strings, bigints, arrays and objects. Every value is checked to fail `accepts()`.

## Errors

| When                                                          | Error                                                                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| the target is not a nominal type or a schema                  | `TypeError: arbitraryOf() takes a nominal type or a schema built by n.of(), n.object(), n.record(), n.tuple() or n.union() (was …)` |
| nothing to generate a type from                               | `TypeError: arbitraryOf(): no generator makes values of <name>: …`                                                                  |
| a field of another library without JSON Schema                | `TypeError: arbitraryOf(): no generator makes values of the field <key>, …`                                                         |
| `unique` items can't fill `min`                               | `TypeError: arbitraryOf(): n.of(<name>).array() needs <min> distinct items, and its items come in fewer kinds`                      |
| a rule or a constraint refuses 1000 generated values in a row | `Error: arbitraryOf(): <target> refused 1000 generated values in a row, …`, thrown while values are made                            |
| the target accepts 1000 changed values in a row               | `Error: invalidArbitraryOf(): <target> accepted 1000 changed values in a row, …`, thrown while values are made                      |

Each message ends with how to pass a generator of your own. Pass it in `overrides`.

## Limits

- A constructor of your own is not run while values are made. A type whose constructor refuses more than its rules can get values `parse()` refuses, and `as: 'instances'` drops them.
- Values with `as: 'inputs'` are what the target takes in code. Some can't travel as JSON: bigints, `NaN`, `undefined` items, Temporal objects.

[← Reference](README.md)
