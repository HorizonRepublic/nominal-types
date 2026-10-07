# Built-in types

Every built-in type sits under a base type for its kind of value, and every one is a subtype of the type above it: it passes wherever that type is expected, while the type above does not pass for it.

```text
AnyString                 any string
├── Email
├── Uuid
└── Url
    └── HttpUrl

AnyNumber                 any number, NaN and the infinities included
└── FiniteNumber          every number JSON can carry
    ├── PositiveNumber        > 0
    ├── NegativeNumber        < 0
    ├── NonNegativeNumber     ≥ 0
    ├── NonPositiveNumber     ≤ 0
    ├── Float32
    └── Integer               a safe integer
        ├── PositiveInteger       ≥ 1
        ├── NegativeInteger       ≤ -1
        ├── NonNegativeInteger    ≥ 0
        ├── NonPositiveInteger    ≤ 0
        ├── Int8, Int16, Int32
        └── Uint8, Uint16, Uint32

AnyBigInt                 any integer as a bigint
├── PositiveBigInt            ≥ 1
├── NegativeBigInt            ≤ -1
├── NonNegativeBigInt         ≥ 0
├── NonPositiveBigInt         ≤ 0
├── Int64
└── Uint64

AnyBoolean                true or false
```

Declare your own types under the base that fits, so they get its check and pass where it is expected. See [Building on a type](../guides/building-on-types.md#starting-from-a-base-type).

## Strings

### AnyString

Any string, the empty one included. A rule added under it, such as a pattern, runs without a separate string check: a pattern rejects anything but a string by itself.

```ts
export class Slug extends AnyString.subtype('Slug', /^[a-z0-9]+(?:-[a-z0-9]+)*$/u) {}
```

### Email

An email address in the dot-atom form RFC 5322 defines, at most 64 characters before the `@` and 254 in all, with plus addressing understood. Quoted local parts, IP-literal domains and Unicode domains are rejected; a Unicode domain passes once converted to punycode.

```ts
const email = new Email('Jane.Doe+news@Example.com');
```

| Member                 | Returns                                    | Example                           |
| ---------------------- | ------------------------------------------ | --------------------------------- |
| `local`                | everything before the `@`                  | `'Jane.Doe+news'`                 |
| `domain`               | everything after the `@`                   | `'Example.com'`                   |
| `mailbox`              | the local part without its tag             | `'Jane.Doe'`                      |
| `tag`                  | what follows the first `+`, or `undefined` | `'news'`                          |
| `withTag(tag)`         | the same mailbox with another tag          | `Jane.Doe+billing@Example.com`    |
| `withoutTag()`         | the same mailbox without a tag             | `Jane.Doe@Example.com`            |
| `canonical()`          | lowered and without a tag                  | `jane.doe@example.com`            |
| `isSameMailbox(other)` | whether both reach one mailbox             | `true` for `jane.doe@EXAMPLE.com` |

Use `canonical()` to tell whether two addresses belong to one person, say for a unique index; `equals()` compares exactly. Provider rules such as Gmail ignoring dots are up to you. `Email.pattern` and the fragments it's built from, `Email.atom`, `Email.label` and `Email.topLevel`, are static fields.

### Uuid

A UUID in its 8-4-4-4-12 text form: versions 1 to 8, the nil and the max value, in either case.

```ts
const id = new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');
```

| Member            | Returns                                                   | Example |
| ----------------- | --------------------------------------------------------- | ------- |
| `version`         | the version digit, 0 for nil and 15 for max               | `7`     |
| `timestamp`       | the generation time of a version 7 UUID, else `undefined` | `Date`  |
| `isNil` / `isMax` | whether it is the nil or the max UUID                     | `false` |
| `canonical()`     | the same UUID in lowercase                                |         |
| `equals(other)`   | compares regardless of case                               |         |

The pattern is the static field `Uuid.pattern`.

### Url

An absolute URL as the WHATWG URL standard parses it, with any scheme, `mailto:` and `javascript:` included. The value keeps the text as given, while the accessors read the parsed form.

```ts
const url = new Url('https://Example.com:8443/a/b?x=1#top');
```

| Member              | Returns                             | Example                                |
| ------------------- | ----------------------------------- | -------------------------------------- |
| `protocol`          | the scheme with its colon           | `'https:'`                             |
| `hostname` / `host` | the host, without and with the port | `'example.com'` / `'example.com:8443'` |
| `origin`            | scheme, host and port               | `'https://example.com:8443'`           |
| `pathname`          | the path                            | `'/a/b'`                               |
| `searchParams`      | a fresh copy of the query           | `URLSearchParams`                      |
| `toURL()`           | a fresh `URL`                       |                                        |
| `canonical()`       | the URL as the parser serialises it | `https://example.com:8443/a/b?x=1#top` |

### HttpUrl

A `Url` whose scheme is `http` or `https`, a subtype of `Url`: every `HttpUrl` is a `Url`, while a `Url` is not necessarily an `HttpUrl`.

```ts
new HttpUrl('https://example.com'); // fine
new HttpUrl('mailto:jane@example.com'); // throws NominalError
```

## Numbers

### AnyNumber and FiniteNumber

`AnyNumber` takes any value of type `number`, `NaN`, `Infinity` and `-Infinity` included. `FiniteNumber` takes the rest, every number JSON can carry: `JSON.stringify` writes `NaN` and the infinities as `null`, so a value that travels as JSON belongs under `FiniteNumber`. A `number` is a 64-bit float, so `FiniteNumber` is the double of other languages.

Wrapper objects such as `new Number(1)` and numeric strings such as `'1'` are rejected by every number type.

### Sign

Each sign comes in two forms, and they differ only on zero:

| Type                 | Accepts | Zero | Typical use                          |
| -------------------- | ------- | ---- | ------------------------------------ |
| `PositiveNumber`     | `> 0`   | no   | a price, a weight                    |
| `NonNegativeNumber`  | `≥ 0`   | yes  | a balance, a distance                |
| `NegativeNumber`     | `< 0`   | no   | a write-off                          |
| `NonPositiveNumber`  | `≤ 0`   | yes  | an adjustment that never adds        |
| `PositiveInteger`    | `≥ 1`   | no   | a quantity in an order, a serial id  |
| `NonNegativeInteger` | `≥ 0`   | yes  | a count that may be empty, an offset |
| `NegativeInteger`    | `≤ -1`  | no   |                                      |
| `NonPositiveInteger` | `≤ 0`   | yes  |                                      |

`-0` counts as zero: the non-negative and non-positive types take it, the positive and negative ones don't. It stays `-0` in `value`, and since `equals()` compares with `Object.is`, `-0` and `0` are not equal. By the same rule `NaN` equals `NaN`.

### Integer

A whole number from `Number.MIN_SAFE_INTEGER` to `Number.MAX_SAFE_INTEGER`. Beyond that range a `number` can't hold every integer, so `2 ** 53 + 1` would silently turn into `2 ** 53`; such values are rejected rather than rounded. Larger integers belong under `AnyBigInt`.

### Sized integers

For columns and binary formats with a fixed width:

| Type     | Range                           | JSON Schema               |
| -------- | ------------------------------- | ------------------------- |
| `Int8`   | -128 to 127                     | `integer` with bounds     |
| `Int16`  | -32,768 to 32,767               | `integer` with bounds     |
| `Int32`  | -2,147,483,648 to 2,147,483,647 | `integer`, format `int32` |
| `Uint8`  | 0 to 255                        | `integer` with bounds     |
| `Uint16` | 0 to 65,535                     | `integer` with bounds     |
| `Uint32` | 0 to 4,294,967,295              | `integer` with bounds     |

All of them sit under `Integer`, next to the sign types: a `Uint8` is not a `NonNegativeInteger`, even though every value it holds would be one.

### Float32

A finite number that a 32-bit float holds exactly, for `real` columns and `Float32Array`. Most decimals have no exact 32-bit form, so `0.1` is rejected while `0.5` and `0.25` pass; round with `Math.fround()` first:

```ts
new Float32(Math.fround(0.1)); // fine
new Float32(0.1); // throws NominalError
```

JSON Schema has no way to say this, so the type describes itself as a number with the `float` format.

## Big integers

### AnyBigInt

Any integer as a `bigint`. JSON has no bigint, so the type also takes the integer as a decimal string and writes a string back:

```ts
const id = new AnyBigInt('9007199254740993');

id.value; // 9007199254740993n
JSON.stringify({ id }); // '{"id":"9007199254740993"}'
```

The string has to be plain decimal: `'-42'` passes, while `'+42'`, `'042'`, `'-0'`, `'1e3'`, `'0x10'` and strings with spaces don't. A string is refused beyond 1000 characters before it is converted, because conversion slows down faster than the length grows; a `bigint` value has no limit. JSON Schema describes the string form.

### Sign, Int64 and Uint64

The sign types follow the same rule as the number ones: `PositiveBigInt` starts at 1, `NonNegativeBigInt` at 0. `Int64` holds -2^63 to 2^63 - 1, the range of a Postgres `bigint`; `Uint64` holds 0 to 2^64 - 1. Their JSON Schema limits the string to 20 characters rather than to the range, so a string of the right length beyond the range passes the schema and is refused when the type is built.

## Booleans

### AnyBoolean

`true` or `false`, and nothing that merely converts to one. A flag with a meaning of its own is a subtype:

```ts
export class MarketingConsent extends AnyBoolean.subtype('MarketingConsent') {}
```

[← Documentation](../README.md)
