# Strings

[Built-in types](README.md) › Strings

## AnyString

Root of the string types.

| Property    | Value                                     |
| ----------- | ----------------------------------------- |
| Accepts     | any string, `''` included                 |
| Rejects     | anything else, `new String('x')` included |
| JSON Schema | `{ type: 'string' }`                      |
| Message     | `must be a string (was 42)`               |

```ts
import { AnyString } from '@horizon-republic/nominal-types';

new AnyString('').value; // ''
```

## NonEmptyString

`AnyString` › `NonEmptyString`

A string of at least one character, for a required text field. A string of spaces passes. The value is never trimmed.

| Property    | Value                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', minLength: 1 }`, with an example                          |
| Message     | `must be a non-empty string (was "")`, also for a value that is not a string |

```ts
import { NonEmptyString } from '@horizon-republic/nominal-types';

new NonEmptyString(' ').value; // ' '
new NonEmptyString(''); // throws NominalError: nominal.NonEmptyString: must be a non-empty string (was "")
```

## NonBlankString

`AnyString` › `NonEmptyString` › `NonBlankString`

A string with at least one character that is not [white space](../glossary.md), for a name or a title. The value is never trimmed: `' Jane '` stays `' Jane '`.

White space is the 25 characters Unicode marks as `White_Space`: spaces, tabs, line breaks and the like. This set is not the one `trim()` removes:

| Character                | `NonBlankString` | `trim()` |
| ------------------------ | ---------------- | -------- |
| U+0085, next line        | white space      | kept     |
| U+FEFF, byte order mark  | a character      | removed  |
| U+200B, zero-width space | a character      | kept     |

| Property    | Value                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', minLength: 1, pattern: NonBlankString.pattern.source }`, with an example |
| Message     | `must be a non-blank string (was "   ")`; `''` gets the message of `NonEmptyString`         |

```ts
import { NonBlankString } from '@horizon-republic/nominal-types';

new NonBlankString(' Jane ').value; // ' Jane '
new NonBlankString('   '); // throws NominalError: nominal.NonBlankString: must be a non-blank string (was "   ")
```

| Static field             | Holds                                               |
| ------------------------ | --------------------------------------------------- |
| `NonBlankString.pattern` | a `RegExp` that finds one character not white space |

## Email

`AnyString` › `Email`

An email address like `jane.doe+news@example.com`.

- Up to 64 characters before the `@`, and up to 254 in total.
- A `+tag` before the `@` is understood, see the `tag` member.
- Not accepted: quoted names (`"jane"@example.com`), IP addresses (`jane@[127.0.0.1]`) and non-Latin domains. Convert a non-Latin domain to punycode first (`xn--…`).

| Property    | Value                                                                                                                                                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern, format: 'email', minLength: 6, maxLength: 254, not: { pattern: '^[^@]{65}' } }`, with an example. `pattern` is `Email.pattern` without its lookaheads, so tools without lookahead support can read it. The length limits and `not` keep the same rules. |
| Message     | `must be an email address (was a string of 1 character)`. `Email` is a [sensitive type](../errors-and-messages.md#sensitive-types), so the value is hidden.                                                                                                                         |

```ts
import { Email } from '@horizon-republic/nominal-types';

const email = new Email('Jane.Doe+news@Example.com');

email.tag; // 'news'
email.canonical().value; // 'jane.doe@example.com'
```

Members, with results for this `email`:

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

`equals()` compares the text exactly. `canonical()` and `isSameMailbox()` apply no provider rules, such as Gmail ignoring dots.

The static fields help build patterns of your own for email-like values.

| Static field     | Holds                                                    |
| ---------------- | -------------------------------------------------------- |
| `Email.pattern`  | the whole address as a `RegExp`, with the length limits  |
| `Email.atom`     | one dot-separated piece of the local part, as a fragment |
| `Email.label`    | one domain label, as a fragment                          |
| `Email.topLevel` | the top-level domain, as a fragment                      |

## E164PhoneNumber

`AnyString` › `E164PhoneNumber`

A phone number in the international [E.164](../glossary.md) format, like `+14155552671`.

- `+`, then 15 digits at most. The first digit is not `0`.
- The number starts with a country calling code that ITU-T has assigned, such as `1`, `44` or `380`. The package carries the list of codes, as of 8 October 2026.
- At least one digit follows the country calling code.
- Spaces, dashes, dots and brackets are refused, with their own message. Remove them before you check the value: `text.replaceAll(/[\s().-]/gu, '')`.
- Only the format is checked. The type doesn't know whether a number is in use in its country. To check that, add a rule with [libphonenumber-js](https://www.npmjs.com/package/libphonenumber-js), as shown below.

| Property    | Value                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: E164PhoneNumber.pattern.source, minLength: 3, maxLength: 16 }`, with an example                                                                           |
| Message     | `must be a phone number in E.164 format (was a string of 11 characters)`. `E164PhoneNumber` is a [sensitive type](../errors-and-messages.md#sensitive-types), so the value is hidden. |
| Message     | `must be a phone number in E.164 format, without spaces, dashes or brackets (was a string of 15 characters)`                                                                          |
| Limits      | the `pattern` doesn't know the country calling codes, so the schema accepts `+2812345678`                                                                                             |

```ts
import { E164PhoneNumber } from '@horizon-republic/nominal-types';

const phone = new E164PhoneNumber('+380441234567');

phone.countryCallingCode; // '380'
new E164PhoneNumber('+1 415 555 2671'); // throws NominalError: nominal.E164PhoneNumber: must be a phone number in E.164 format, without spaces, dashes or brackets (was a string of 15 characters)
```

Members, with results for this `phone`:

| Member               | Returns                                   | Example          |
| -------------------- | ----------------------------------------- | ---------------- |
| `countryCallingCode` | the country calling code, without `+`     | `'380'`          |
| `nationalNumber`     | the digits after the country calling code | `'441234567'`    |
| `digits`             | every digit, without `+`                  | `'380441234567'` |

| Static field                          | Holds                                                           |
| ------------------------------------- | --------------------------------------------------------------- |
| `E164PhoneNumber.countryCallingCodes` | every accepted country calling code, without `+`                |
| `E164PhoneNumber.pattern`             | the format as a `RegExp`, without the check of the calling code |

To accept only numbers in use, declare a subtype with a rule from libphonenumber-js:

```ts
import { isValidPhoneNumber } from 'libphonenumber-js/max';

import { E164PhoneNumber, n } from '@horizon-republic/nominal-types';

const isInUse = (value: unknown): value is string =>
  typeof value === 'string' && isValidPhoneNumber(value);

class PhoneNumber extends E164PhoneNumber.subtype(
  'crm.PhoneNumber',
  n.satisfying(isInUse, 'a phone number in use', { type: 'string' }),
) {}

new PhoneNumber('+14155552671').value; // '+14155552671'
new PhoneNumber('+15555550000'); // throws NominalError: crm.PhoneNumber: must be a phone number in use (was a string of 12 characters)
```

## Uuid

`AnyString` › `Uuid`

A UUID like `0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f`.

- Versions 1 to 8, with the variant of RFC 9562: the first digit of the fourth group is `8`, `9`, `a` or `b`.
- The all-zero and all-`f` values.
- Upper and lower case are both accepted and kept as given.

| Property    | Value                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Uuid.pattern.source, format: 'uuid', minLength: 36, maxLength: 36 }`, with an example |
| Message     | `must be a UUID (was "x")`                                                                                        |

```ts
import { Uuid } from '@horizon-republic/nominal-types';

const id = new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');

id.version; // 7
```

| Member            | Returns                                                   | Example |
| ----------------- | --------------------------------------------------------- | ------- |
| `version`         | the version digit, 0 for nil and 15 for max               | `7`     |
| `timestamp`       | the generation time of a version 7 UUID, else `undefined` | `Date`  |
| `isNil` / `isMax` | whether it is the nil or the max UUID                     | `false` |
| `canonical()`     | the same UUID in lowercase                                |         |
| `equals(other)`   | compares regardless of case                               |         |

| Static field   | Holds                  |
| -------------- | ---------------------- |
| `Uuid.pattern` | the UUID as a `RegExp` |

## UuidV4 and UuidV7

`AnyString` › `Uuid` › `UuidV4`, and `AnyString` › `Uuid` › `UuidV7`

A `Uuid` of one version, as RFC 9562 defines it. Both have the members of `Uuid`.

- `UuidV4` is random. Use it for an id that must not tell when it was made.
- `UuidV7` starts with the time it was made, so ids sort by time. Its `timestamp` is always a `Date`.
- The nil and max UUIDs are not accepted.
- `canonical()` keeps the type: `UuidV4` gives a `UuidV4`, as every [method that returns a changed copy](README.md#common-to-every-built-in-type) does.

| Property    | Value                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| JSON Schema | `allOf` of `Uuid`'s and `{ type: 'string', pattern: '^.{14}4' }` (`7` for `UuidV7`), with an example |
| Message     | `must be a version 4 UUID (was "0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f")`                              |

```ts
import { Uuid, UuidV7 } from '@horizon-republic/nominal-types';

const id = new UuidV7('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');

id.timestamp; // 2024-07-27T01:15:56.618Z
id.equals(new Uuid('0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F')); // true
```

| Static field                       | Holds                                          |
| ---------------------------------- | ---------------------------------------------- |
| `UuidV4.pattern`, `UuidV7.pattern` | a UUID of that version as a `RegExp`, to reuse |

## Ulid

`AnyString` › `Ulid`

A [ULID](../glossary.md) like `01ARZ3NDEKTSV4RRFFQ69G5FAV`: an id that starts with the time it was made, as the [ULID specification](https://github.com/ulid/spec) writes it.

- 26 characters: digits and letters except `I`, `L`, `O` and `U`.
- The first character is `0` to `7`.
- Upper and lower case are both accepted and kept as given.

| Property    | Value                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Ulid.pattern.source, minLength: 26, maxLength: 26 }`, with an example |
| Message     | `must be a ULID (was "x")`                                                                        |

```ts
import { Ulid } from '@horizon-republic/nominal-types';

const id = new Ulid('01arz3ndektsv4rrffq69g5fav');

id.timestamp; // 2016-07-30T23:54:10.259Z
id.canonical().value; // '01ARZ3NDEKTSV4RRFFQ69G5FAV'
```

| Member          | Returns                           |
| --------------- | --------------------------------- |
| `timestamp`     | the time it was made, as a `Date` |
| `canonical()`   | the same ULID in uppercase        |
| `equals(other)` | compares regardless of case       |

| Static field   | Holds                  |
| -------------- | ---------------------- |
| `Ulid.pattern` | the ULID as a `RegExp` |

## TypeId

`AnyString` › `TypeId`

An id with its kind in front, like `user_01h455vb4pex5vsknk084sn02q`, as the [TypeID specification](https://github.com/jetify-com/typeid/tree/main/spec) 0.3.0 writes it. A [TypeID](../glossary.md) is a prefix, `_`, and a UUID written in 26 characters.

- The prefix is up to 63 lowercase letters and `_`. It starts and ends with a letter: `my_type` passes, `_user` and `user_` don't.
- The prefix may be left out together with its `_`: `01h455vb4pex5vsknk084sn02q` passes.
- The suffix is 26 characters of `0123456789abcdefghjkmnpqrstvwxyz`, lowercase only. Its first character is `0` to `7`.
- Any UUID passes, not only version 7. `generate()` always makes a version 7 UUID.

| Property    | Value                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: TypeId.pattern.source, minLength: 26, maxLength: 90 }`, with an example |
| Message     | `must be a TypeID (was "User_01h455vb4pex5vsknk084sn02q")`                                          |

```ts
import { TypeId } from '@horizon-republic/nominal-types';

const id = new TypeId('user_01h455vb4pex5vsknk084sn02q');

id.prefix; // 'user'
id.toUuid(); // Uuid { value: '01890a5d-ac96-774b-bcce-b302099a8057' }
TypeId.fromUuid('01890a5d-ac96-774b-bcce-b302099a8057', 'user').value; // 'user_01h455vb4pex5vsknk084sn02q'
```

Members, with results for this `id`:

| Member      | Returns                                                                         | Example                                                  |
| ----------- | ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `prefix`    | the text in front of the last `_`; `''` without a prefix                        | `'user'`                                                 |
| `suffix`    | the last 26 characters                                                          | `'01h455vb4pex5vsknk084sn02q'`                           |
| `timestamp` | the time it was made, as a `Date`, for a version 7 UUID; `undefined` for others | `2023-06-30T03:34:18.518Z`                               |
| `toUuid()`  | the UUID inside, in lowercase, as a [`Uuid`](#uuid)                             | `Uuid { value: '01890a5d-ac96-774b-bcce-b302099a8057' }` |

`toUuid()` throws `NominalError` when the 128 bits are not a UUID that `Uuid` accepts, such as `00000000000000000000000001`.

### One kind of id

Give `TypeId.withPrefix()` to `subtype()`. The type takes only ids with that prefix:

```ts
import { TypeId } from '@horizon-republic/nominal-types';

class UserId extends TypeId.subtype('shop.UserId', TypeId.withPrefix('user')) {}

const id = UserId.generate(); // UserId { value: 'user_01m4…' }, new each time

UserId.parse('order_01h455vb4pex5vsknk084sn02q'); // { ok: false, issues: [{ message: 'must be a TypeID with the prefix user (was "order_01h455vb4pex5vsknk084sn02q")' }] }
```

`TypeId.withPrefix('')` makes a type of ids without a prefix. A prefix that breaks the prefix rules of the specification throws a `TypeError`.

| Static member                  | Does                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `TypeId.withPrefix(prefix)`    | a rule for `subtype()` that takes only ids with this prefix                                                    |
| `Type.generate(prefix?)`       | a new id around a new version 7 UUID. The prefix is the one the type fixes, or the one given, or none.         |
| `Type.fromUuid(uuid, prefix?)` | the id of a UUID you already have, as a `Uuid` or as text in either case. The prefix works as in `generate()`. |
| `TypeId.pattern`               | the TypeID as a `RegExp`                                                                                       |

`generate()` and `fromUuid()` build the type they are called on: `UserId.generate()` is a `UserId`. Ids made by one process sort by the time they were made, also within one millisecond.

## ObjectId

`AnyString` › `ObjectId`

A MongoDB ObjectId like `507f1f77bcf86cd799439011`: 24 hex digits. The first eight hold the second it was made.

- Upper and lower case are both accepted and kept as given.
- All zeros is a valid ObjectId.

| Property    | Value                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: ObjectId.pattern.source, minLength: 24, maxLength: 24 }`, with an example |
| Message     | `must be an ObjectId (was "x")`                                                                       |

```ts
import { ObjectId } from '@horizon-republic/nominal-types';

const id = new ObjectId('507F1F77BCF86CD799439011');

id.timestamp; // 2012-10-17T21:13:27.000Z
id.canonical().value; // '507f1f77bcf86cd799439011'
```

| Member          | Returns                             |
| --------------- | ----------------------------------- |
| `timestamp`     | the second it was made, as a `Date` |
| `canonical()`   | the same ObjectId in lowercase      |
| `equals(other)` | compares regardless of case         |

| Static field       | Holds                      |
| ------------------ | -------------------------- |
| `ObjectId.pattern` | the ObjectId as a `RegExp` |

## SemVer

`AnyString` › `SemVer`

A [semantic version](../glossary.md) like `2.0.0-rc.1+build.5`, as [Semantic Versioning 2.0.0](https://semver.org) writes it: `MAJOR.MINOR.PATCH`, then an optional `-prerelease` and `+build` part.

- No leading `v`: `v1.2.3` is not accepted.
- No leading zeros in numbers: `01.0.0` and `1.0.0-01` are not accepted. Build parts may have them: `1.0.0+01`.
- Up to 256 characters, and each number up to `Number.MAX_SAFE_INTEGER`.

| Property    | Value                                                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern, minLength: 5, maxLength: 256 }`, with examples. `pattern` is `SemVer.pattern` without its lookahead, so tools without lookahead support can read it. The length limits keep the same rule. |
| Message     | `must be a semantic version (was "v1.2.3")`                                                                                                                                                                            |

```ts
import { SemVer } from '@horizon-republic/nominal-types';

const version = new SemVer('2.0.0-rc.1+build.5');

version.prerelease; // ['rc', 1]
version.isNewerThan(new SemVer('2.0.0-beta.9')); // true
```

Members, with results for this `version`:

| Member                    | Returns                                                        | Example          |
| ------------------------- | -------------------------------------------------------------- | ---------------- |
| `major`, `minor`, `patch` | the three numbers                                              | `2`, `0`, `0`    |
| `prerelease`              | the parts after `-`, numbers as numbers; `[]` without them     | `['rc', 1]`      |
| `build`                   | the parts after `+`, as text; `[]` without them                | `['build', '5']` |
| `isPrerelease`            | whether there is a prerelease part                             | `true`           |
| `compare(other)`          | `-1` if this version comes first, `1` if after, `0` if neither |                  |
| `isNewerThan(other)`      | whether this version comes after the other                     |                  |

`compare()` follows the order of the specification: `1.0.0-alpha` < `1.0.0-alpha.1` < `1.0.0-beta` < `1.0.0`. The build part doesn't count, so `1.0.0+a` and `1.0.0+b` compare as `0`. `equals()` compares the text, so they are not equal.

Sort a list with `compare()`:

```ts
import { SemVer } from '@horizon-republic/nominal-types';

const versions = ['1.0.0', '1.0.0-beta', '0.9.12'].map((text) => new SemVer(text));

versions.sort((a, b) => a.compare(b)).map(String); // ['0.9.12', '1.0.0-beta', '1.0.0']
```

| Static field     | Holds                     |
| ---------------- | ------------------------- |
| `SemVer.pattern` | the version as a `RegExp` |

## Url

`AnyString` › `Url`

An absolute URL like `https://example.com/a?b=1`: anything `new URL(text)` accepts.

- Any scheme is accepted, including `javascript:`, `data:`, `file:` and `mailto:`. Use `HttpUrl` for a link shown to users or opened by your server.
- `value` keeps the text as given. The members read the parsed URL.
- Spaces and control characters are refused anywhere: `' https://example.com'`, `'https://example.com/a b'`, `'https://exa\nmple.com'`. A URL can't hold them, and `new URL()` would drop or encode them, so the value would differ from the URL it read.
- The host is read as browsers read it: `http://0x7f.1` has the `hostname` `127.0.0.1`. To refuse internal hosts, check `hostname` with [`IpAddress`](#ipaddress) and its `isGlobal`.

| Property    | Value                                                            |
| ----------- | ---------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', format: 'uri', pattern }`, with an example    |
| Message     | `must be a URL (was "x")`, also for a value that is not a string |

```ts
import { Url } from '@horizon-republic/nominal-types';

const url = new Url('https://Example.com:8443/a/b?x=1#top');

url.hostname; // 'example.com'
```

Members, with results for this `url`:

| Member              | Returns                                             | Example                                |
| ------------------- | --------------------------------------------------- | -------------------------------------- |
| `protocol`          | the scheme with its colon                           | `'https:'`                             |
| `hostname` / `host` | the host, without and with the port                 | `'example.com'` / `'example.com:8443'` |
| `origin`            | scheme, host and port                               | `'https://example.com:8443'`           |
| `pathname`          | the path                                            | `'/a/b'`                               |
| `searchParams`      | a fresh copy of the query                           | `URLSearchParams`                      |
| `toURL()`           | a fresh `URL`                                       |                                        |
| `canonical()`       | a `Url` of the text the parser writes, host lowered | `https://example.com:8443/a/b?x=1#top` |

## HttpUrl

`AnyString` › `Url` › `HttpUrl`

A `Url` whose scheme is `http` or `https`, in any case. It has the members of `Url`.

| Property    | Value                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', format: 'uri', pattern: '^[Hh][Tt][Tt][Pp][Ss]?:\\/\\/' }`, with an example |
| Message     | `must be an http or https URL (was "mailto:jane@example.com")`                                 |

```ts
import { HttpUrl } from '@horizon-republic/nominal-types';

new HttpUrl('https://example.com').value; // 'https://example.com'
new HttpUrl('mailto:jane@example.com'); // throws NominalError: nominal.HttpUrl: must be an http or https URL (was "mailto:jane@example.com")
```

## CountryCode

`AnyString` › `CountryCode`

A country or territory as its two-letter [ISO 3166-1](../glossary.md) code, like `US` or `UA`.

- The 249 codes officially assigned as of 8 October 2026, and `XK` for Kosovo. The package carries this list, so the Node version doesn't change it.
- Upper case only: `us` is refused.
- Reserved codes are refused: `UK` (write `GB`) and `EU`.

| Property    | Value                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------ |
| JSON Schema | `{ type: 'string', enum: CountryCode.codes, minLength: 2, maxLength: 2 }`, with an example |
| Message     | `must be an ISO 3166-1 alpha-2 country code (was "UK")`                                    |

```ts
import { CountryCode } from '@horizon-republic/nominal-types';

new CountryCode('UA').flag; // '🇺🇦'
new CountryCode('UK'); // throws NominalError: nominal.CountryCode: must be an ISO 3166-1 alpha-2 country code (was "UK")
```

| Member | Returns                     | Example |
| ------ | --------------------------- | ------- |
| `flag` | the flag emoji for the code | `'🇺🇦'`  |

| Static field        | Holds                                      |
| ------------------- | ------------------------------------------ |
| `CountryCode.codes` | every accepted code, in alphabetical order |

To accept a code outside the list, such as `EU`, declare your own type from `CountryCode.codes`:

```ts
import { AnyString, CountryCode } from '@horizon-republic/nominal-types';

const codes = [...CountryCode.codes, 'EU'].join('|');

class Region extends AnyString.subtype('geo.Region', new RegExp(`^(?:${codes})$`, 'u')) {}

new Region('EU').value; // 'EU'
```

## CurrencyCode

`AnyString` › `CurrencyCode`

A currency as its three-letter [ISO 4217](../glossary.md) code, like `EUR` or `JPY`.

- The 178 codes of ISO 4217 List One, as published on 17 September 2026. The package carries this list, so the Node version doesn't change it.
- Upper case only: `eur` is refused.
- Codes that are not money are accepted too: funds such as `CLF`, metals such as `XAU`, `XTS` for tests and `XXX` for "no currency".
- Withdrawn codes are refused, such as `HRK` and `BGN`.

| Property    | Value                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', enum: CurrencyCode.codes, minLength: 3, maxLength: 3 }`, with an example |
| Message     | `must be an ISO 4217 currency code (was "HRK")`                                             |

```ts
import { CurrencyCode } from '@horizon-republic/nominal-types';

new CurrencyCode('JPY').minorUnits; // 0
new CurrencyCode('HRK'); // throws NominalError: nominal.CurrencyCode: must be an ISO 4217 currency code (was "HRK")
```

| Member       | Returns                                                           | Example                              |
| ------------ | ----------------------------------------------------------------- | ------------------------------------ |
| `minorUnits` | the [minor units](../glossary.md): digits after the decimal point | `2` for `EUR`, `undefined` for `XAU` |
| `isFund`     | whether ISO marks the code as a fund, not a currency              | `true` for `CLF`, `false` for `USD`  |

| Static field         | Holds                                      |
| -------------------- | ------------------------------------------ |
| `CurrencyCode.codes` | every accepted code, in alphabetical order |

## DecimalString

`AnyString` › `DecimalString`

An exact decimal number written as text, like `'12.34'`. Use it for amounts of money and other numbers where a [floating-point number](../glossary.md) would lose digits. [How to handle money](../../guides/core/handle-money.md) shows it at work.

- An optional `-`, then digits, then an optional `.` with at least one digit.
- No leading zeros: `01` is refused, `0.5` passes.
- Refused: `+1`, `.5`, `5.`, `1e3`, spaces, and a number instead of a string.
- Up to 100 characters.
- The text is kept as written: `'1.50'` keeps its zero, and `'-0'` passes.

| Property    | Value                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern, minLength: 1, maxLength: 100 }`, with examples. `pattern` is `DecimalString.pattern` without its lookahead; `maxLength` keeps the limit. |
| Message     | `must be a decimal number as text (was "1e3")`                                                                                                                       |

```ts
import { DecimalString } from '@horizon-republic/nominal-types';

const price = new DecimalString('12.50');

price.toMinorUnits(2); // 1250n
price.canonical().value; // '12.5'
price.equals(new DecimalString('12.5')); // true
DecimalString.fromMinorUnits(1250n, 2).value; // '12.50'
```

Members, with results for `new DecimalString('-0.50')`:

| Member                | Returns                                                                        | Example        |
| --------------------- | ------------------------------------------------------------------------------ | -------------- |
| `sign`                | `-1`, `0` or `1`; `0` for `-0` too                                             | `-1`           |
| `integerDigits`       | how many digits stand before the point                                         | `1`            |
| `fractionDigits`      | how many digits stand after the point, as written                              | `2`            |
| `toMinorUnits(scale)` | the number times 10 to the power of `scale`, as a `bigint`                     | `-50n` for `2` |
| `compare(other)`      | `-1` if this number is smaller, `1` if larger, `0` if equal; exact             |                |
| `canonical()`         | the shortest text of the same number: trailing zeros dropped, `-0` written `0` | `'-0.5'`       |
| `equals(other)`       | whether the numbers are equal: `'1.5'` equals `'1.50'`                         |                |

`>` and `<` compare the text, not the number: `'10' > '9'` is `false`. Use `compare()`.

`toMinorUnits()` throws a `RangeError` when a digit other than zero would be lost: `toMinorUnits(): 12.345 has more than 2 digits after the point`.

| Static member                                 | Does                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DecimalString.fromMinorUnits(amount, scale)` | the text of `amount` divided by 10 to the power of `scale`, with exactly `scale` digits after the point |
| `DecimalString.pattern`                       | the number as a `RegExp`, with the length limit                                                         |

Both `toMinorUnits()` and `fromMinorUnits()` throw a `RangeError` for a `scale` that isn't a whole number from 0 up.

## LanguageTag

`AnyString` › `LanguageTag`

A [BCP 47](../glossary.md) language tag, like `en`, `en-US` or `zh-Hant-TW`.

- Any case is accepted and kept as given. `equals()` ignores case.
- The type checks the form of the tag, not whether its parts exist: `xx-YY` passes.
- `Intl` accepts every tag this type accepts.
- Refused: `en_US`, a language of four or more letters (`french`), an extended language (`zh-yue`, write `yue`), old irregular tags (`i-klingon`), private use alone (`x-mine`), and a variant or extension written twice (`de-1996-1996`).

| Property    | Value                                                                      |
| ----------- | -------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: LanguageTag.pattern.source }`, with an example |
| Message     | `must be a BCP 47 language tag (was "en_US")`                              |

The JSON Schema can't see a variant or extension written twice, so a JSON Schema validator accepts `de-1996-1996`.

```ts
import { LanguageTag } from '@horizon-republic/nominal-types';

const tag = new LanguageTag('ZH-hant-tw');

tag.region; // 'TW'
tag.canonical().value; // 'zh-Hant-TW'
```

Members, with results for this `tag`:

| Member          | Returns                                           | Example      |
| --------------- | ------------------------------------------------- | ------------ |
| `language`      | the language, lower case                          | `'zh'`       |
| `script`        | the script in title case, or `undefined`          | `'Hant'`     |
| `region`        | the region in upper case, or `undefined`          | `'TW'`       |
| `canonical()`   | the tag as `Intl.getCanonicalLocales()` writes it | `zh-Hant-TW` |
| `equals(other)` | compares regardless of case                       |              |

`canonical()` also replaces old codes, such as `iw` with `he`. That list comes from Node, so a newer Node may replace more.

| Static field          | Holds                 |
| --------------------- | --------------------- |
| `LanguageTag.pattern` | the tag as a `RegExp` |

## MediaType

`AnyString` › `MediaType`

A [media type](../glossary.md) like `text/html; charset=utf-8`: what a `Content-Type` header holds.

- The type and the subtype each start with a letter or digit, then hold letters, digits and `!#$&-^_.+`. Each has up to 127 characters.
- Parameters follow, each as `;` and `name=value`. Spaces and tabs may stand around the `;`.
- A value with characters other than letters, digits and ``!#$%&'*+-.^_`|~`` goes in double quotes: `boundary="a b"`. Inside the quotes, `\` escapes the next character.
- Not accepted: wildcards such as `*/*` and `text/*`, a parameter name given twice, an empty parameter (`text/plain;`) and spaces at either end.

| Property    | Value                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JSON Schema | `{ type: 'string', pattern: MediaType.pattern.source, minLength: 3 }`, with examples. The pattern accepts a parameter name given twice; the type refuses it. |
| Message     | `must be a media type (was "*/*")`                                                                                                                           |

```ts
import { MediaType } from '@horizon-republic/nominal-types';

const type = new MediaType('Application/LD+JSON; Charset="utf-8"');

type.essence; // 'application/ld+json'
type.isJson; // true
```

Members, with results for this `type`:

| Member          | Returns                                                                        | Example                             |
| --------------- | ------------------------------------------------------------------------------ | ----------------------------------- |
| `type`          | the type as written                                                            | `'Application'`                     |
| `subtype`       | the subtype as written                                                         | `'LD+JSON'`                         |
| `suffix`        | what follows the last `+` of the subtype, or `undefined`                       | `'JSON'`                            |
| `essence`       | the type and subtype in lowercase, without parameters                          | `'application/ld+json'`             |
| `parameters`    | a new `Map` of the parameters: names in lowercase, values without quotes       | `Map { 'charset' => 'utf-8' }`      |
| `charset`       | the `charset` parameter, or `undefined`                                        | `'utf-8'`                           |
| `isJson`        | whether it is `application/json` or its subtype ends in `+json`                | `true`                              |
| `canonical()`   | names in lowercase, no spaces, quotes only where a value needs them            | `application/ld+json;charset=utf-8` |
| `equals(other)` | compares the canonical forms: the case of names, spaces and quotes don't count | `true` for the `canonical()` value  |

Parameter values keep their case. `text/html;charset=UTF-8` doesn't equal `text/html;charset=utf-8`.

| Static field        | Holds                                                        |
| ------------------- | ------------------------------------------------------------ |
| `MediaType.pattern` | the media type as a `RegExp`, without the repeated-name rule |

## HexColor

`AnyString` › `HexColor`

A CSS color in hex notation like `#1e90ff`.

- A `#`, then 3, 4, 6 or 8 hex digits: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.
- Upper and lower case are both accepted and kept as given.
- The `#` is required, so `fff` is refused.

| Property    | Value                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: HexColor.pattern.source, minLength: 4, maxLength: 9 }`, with an example |
| Message     | `must be a hex color (was "fff")`                                                                   |

```ts
import { HexColor } from '@horizon-republic/nominal-types';

const color = new HexColor('#1E90FF80');

color.red; // 30
color.canonical().value; // '#1e90ff80'
```

Members, with results for this `color`:

| Member                 | Returns                                                       | Example                 |
| ---------------------- | ------------------------------------------------------------- | ----------------------- |
| `red`, `green`, `blue` | a channel, from 0 to 255                                      | `30`, `144`, `255`      |
| `alpha`                | the opacity, from 0 to 1; 1 when the color has no alpha digit | `0.5019607843137255`    |
| `canonical()`          | `#` and 6 lowercase digits, or 8 when not fully opaque        | `#1e90ff80`             |
| `equals(other)`        | compares the channels                                         | `#FFF` equals `#ffffff` |

| Static field       | Holds                      |
| ------------------ | -------------------------- |
| `HexColor.pattern` | the notation as a `RegExp` |

## Base64

`AnyString` › `Base64`

Bytes written as [base64](../glossary.md) text like `aGVsbG8=`.

- Letters, digits, `+` and `/`, in groups of four characters.
- The last group ends in `=` or `==` when it is short: `Zg==`, `Zm8=`.
- The bits the `=` fills must be zero, so each byte string has one text. `QR==` is refused; `QQ==` is the same byte.
- Not accepted: a missing `=`, spaces, line breaks and the `-_` characters of `Base64Url`.
- The empty string is accepted. It holds zero bytes.

| Property    | Value                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Base64.pattern.source, contentEncoding: 'base64' }`, with an example. For `openapi-3.0`, `format: 'byte'` in its place. |
| Message     | `must be base64 text (was "QQ")`                                                                                                                    |

```ts
import { Base64 } from '@horizon-republic/nominal-types';

const data = new Base64('aGVsbG8=');

data.byteLength; // 5
new TextDecoder().decode(data.toBytes()); // 'hello'
```

| Member          | Returns                                           | Example                                |
| --------------- | ------------------------------------------------- | -------------------------------------- |
| `byteLength`    | the number of bytes                               | `5`                                    |
| `toBytes()`     | the bytes, in a new `Uint8Array` each call        | `Uint8Array [104, 101, 108, 108, 111]` |
| `equals(other)` | compares the text, which is the same as the bytes |                                        |

| Static field     | Holds                      |
| ---------------- | -------------------------- |
| `Base64.pattern` | the encoding as a `RegExp` |

`Base64` has no size limit. To cap the size, or to refuse the empty string, declare a subtype:

```ts
import { Base64, n } from '@horizon-republic/nominal-types';

class Avatar extends Base64.subtype(
  'profile.Avatar',
  n.matching(/^.{4,1000000}$/u, 'from 1 to 750,000 bytes'),
) {}

Avatar.parse(''); // { ok: false, issues: [{ message: 'must be from 1 to 750,000 bytes (was "")' }] }
```

## Base64Url

`AnyString` › `Base64Url`

Bytes written as base64url text like `aGVsbG8`: the [base64](../glossary.md) form that URLs and JSON Web Tokens use.

- Letters, digits, `-` and `_`.
- No `=` at the end: `Zg`, not `Zg==`. Remove the `=` first if a source adds it.
- The bits the last character fills must be zero, as for `Base64`.
- The empty string is accepted.

`Base64Url` is a [sibling](../glossary.md) of `Base64`, not a subtype. Their characters differ, so neither accepts every text of the other.

| Property    | Value                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| JSON Schema | `{ type: 'string', pattern: Base64Url.pattern.source, contentEncoding: 'base64url' }`, with an example. For `openapi-3.0`, no `contentEncoding`. |
| Message     | `must be base64url text (was "Zg==")`                                                                                                            |

```ts
import { Base64Url } from '@horizon-republic/nominal-types';

const token = new Base64Url('aGVsbG8');

token.byteLength; // 5
new TextDecoder().decode(token.toBytes()); // 'hello'
```

It has the members and the static field of `Base64`.

## Jwt

`AnyString` › `Jwt`

A [JWT](../glossary.md), such as an access token from an `Authorization: Bearer` header, in its compact form: a header, a payload and a signature in base64url, joined by dots.

> [!WARNING]
> `Jwt` checks the form of a token, never its signature. Anyone can make a token that `Jwt` accepts. Don't trust `header`, `payload`, `algorithm` or `expiresAt` until a JWT library, such as [jose](https://www.npmjs.com/package/jose), has verified the token with your key.

- Three parts, each in base64url without `=`. The bits the last character fills must be zero, as for `Base64Url`.
- The header and the payload are JSON objects in UTF-8.
- The header has an `alg` that is a non-empty string.
- `exp`, `nbf` and `iat`, where the payload has them, are numbers.
- The signature is empty when `alg` is `none`, and only then.
- Not accepted: encrypted tokens (five parts), the `Bearer ` prefix, and tokens longer than 8,192 characters.

| Property    | Value                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Jwt.pattern.source, maxLength: 8192 }`, with an example                                                                             |
| Message     | `must be a JWT in compact form (was a string of 8 characters)`. `Jwt` is a [sensitive type](../errors-and-messages.md#sensitive-types), so the value is hidden. |
| Limits      | the `pattern` can't decode the parts, so the schema accepts parts that aren't JSON objects, such as `foo.bar.baz`                                               |

```ts
import { Jwt } from '@horizon-republic/nominal-types';

const token = new Jwt(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTQyIiwiZXhwIjoxNzY3MjI1NjAwfQ.ov8aVnMn4lXxVLhUxcOz6r8OM1VJKnuKptMFIyhE0wU',
);

token.algorithm; // 'HS256'
token.expiresAt; // 2026-01-01T00:00:00.000Z
new Jwt('foo.bar.'); // throws NominalError: nominal.Jwt: must be a JWT in compact form (was a string of 8 characters)
```

Members, with results for this `token`. None of them is verified:

| Member      | Returns                                                   | Example                               |
| ----------- | --------------------------------------------------------- | ------------------------------------- |
| `header`    | the header, decoded into a new object each call           | `{ alg: 'HS256', typ: 'JWT' }`        |
| `payload`   | the claims, decoded into a new object each call           | `{ sub: 'user-42', exp: 1767225600 }` |
| `algorithm` | the `alg` of the header                                   | `'HS256'`                             |
| `expiresAt` | a `Date` from the `exp` claim, or `undefined` without one | `2026-01-01T00:00:00.000Z`            |

| Static field    | Holds                                                  |
| --------------- | ------------------------------------------------------ |
| `Jwt.pattern`   | the three parts as a `RegExp`, without the JSON checks |
| `Jwt.maxLength` | `8192`, the longest token accepted                     |

## Hostname

`AnyString` › `Hostname`

A [host name](../glossary.md) like `localhost` or `api.example.com`.

- Labels of letters, digits and hyphens, joined by dots. A label can't start or end with a hyphen.
- Up to 63 characters per label, and up to 253 in total.
- The last label is never all digits, so `192.0.2.1` is not a host name.
- Not accepted: a trailing dot (`example.com.`), underscores (`_dmarc.example.com`) and Unicode text. Convert Unicode to [Punycode](../glossary.md) first (`bücher.de` is `xn--bcher-kva.de`).
- An `xn--` label must decode to lowercase letters and digits of any script, such as `bücher`. A label with `--` in places 3 and 4 is accepted only as an `xn--` label.
- Upper and lower case are both accepted and kept as given.

| Property    | Value                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', format: 'hostname', pattern, minLength: 1, maxLength: 253, not: { pattern: '(?:^\|\\.)[0-9]+$' } }`, with an example |
| Message     | `must be a host name (was "a_b")`                                                                                                       |
| Limits      | the `pattern` can't decode `xn--` labels, so the schema accepts an `xn--` label that is not valid Punycode, such as `xn--zz.com`        |

```ts
import { Hostname } from '@horizon-republic/nominal-types';

const host = new Hostname('API.Example.com');

host.canonical().value; // 'api.example.com'
new Hostname('example.com.'); // throws NominalError: nominal.Hostname: must be a host name (was "example.com.")
```

Members, with results for this `host`:

| Member                | Returns                                         | Example                      |
| --------------------- | ----------------------------------------------- | ---------------------------- |
| `labels`              | the labels between the dots                     | `['API', 'Example', 'com']`  |
| `canonical()`         | the same name in lowercase                      | `api.example.com`            |
| `toUnicode()`         | the name with `xn--` labels decoded, for people | `'API.Example.com'`          |
| `isSubdomainOf(name)` | whether it is `name` or a name under it         | `true` for `example.com`     |
| `equals(other)`       | compares regardless of case                     | `true` for `api.example.com` |

`toUnicode()` gives display text, not a host name: `new Hostname('xn--bcher-kva.de').toUnicode()` is `'bücher.de'`.

## DomainName

`AnyString` › `Hostname` › `DomainName`

A host name with a [top-level domain](../glossary.md), like `example.com`. It has the members of `Hostname`.

- At least two labels.
- The last label is letters only, such as `com`, or an `xn--` label, such as `xn--p1ai` (`рф`).
- `localhost` is a `Hostname` but not a `DomainName`.

| Property    | Value                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------- |
| JSON Schema | `allOf` of `Hostname`'s and `{ type: 'string', pattern }` for the top-level domain, with an example |
| Message     | `must be a domain name with a top-level domain (was "localhost")`                                   |

```ts
import { DomainName } from '@horizon-republic/nominal-types';

new DomainName('example.com').value; // 'example.com'
new DomainName('localhost'); // throws NominalError: nominal.DomainName: must be a domain name with a top-level domain (was "localhost")
```

## IpAddress

`AnyString` › `IpAddress`

An IPv4 or IPv6 address, like `192.0.2.1` or `2001:db8::1`.

- IPv4: four numbers from 0 to 255, joined by dots. A number with a leading zero is refused (`010.0.0.1`), since some tools read it as octal and reach another host.
- IPv6: any form of RFC 4291, such as `2001:db8::1`, `2001:0DB8:0:0:0:0:0:1` or `::ffff:192.0.2.1`.
- Not accepted: short IPv4 forms (`127.1`), hex IPv4 (`0x7f.0.0.1`), a zone (`fe80::1%eth0`) and brackets (`[::1]`).
- `value` keeps the text as given. `equals()` compares the address, and `canonical()` writes it in the short form of RFC 5952.
- `IpAddress` is a [sensitive type](../errors-and-messages.md#sensitive-types), like `Email`, since an address can identify a person.

| Property    | Value                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', anyOf: [{ format: 'ipv4', pattern }, { format: 'ipv6', pattern }], minLength: 2, maxLength: 45 }`, with examples |
| Message     | `must be an IP address (was a string of 9 characters)`                                                                              |

```ts
import { IpAddress } from '@horizon-republic/nominal-types';

const address = new IpAddress('2001:DB8:0:0:0:0:0:1');

address.canonical().value; // '2001:db8::1'
address.equals(new IpAddress('2001:db8::1')); // true
new IpAddress('010.0.0.1'); // throws NominalError: nominal.IpAddress: must be an IP address (was a string of 9 characters)
```

Members:

| Member          | Returns                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `version`       | `4` or `6`                                                                                     |
| `toBytes()`     | the address as a `Uint8Array`, 4 bytes for IPv4 and 16 for IPv6                                |
| `canonical()`   | the address in the form of RFC 5952: lowercase, no leading zeros, the longest zero run as `::` |
| `equals(other)` | whether both are the same address, however they are written                                    |
| `isLoopback`    | `127.0.0.0/8` or `::1`                                                                         |
| `isPrivate`     | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` or `fc00::/7`                                  |
| `isLinkLocal`   | `169.254.0.0/16` or `fe80::/10`                                                                |
| `isMulticast`   | `224.0.0.0/4` or `ff00::/8`                                                                    |
| `isUnspecified` | `0.0.0.0` or `::`                                                                              |
| `isGlobal`      | whether the address can be reached across the internet                                         |

`isGlobal` follows the IANA special-purpose address registries. It is `false` for private, shared, documentation, benchmarking and reserved addresses, for multicast, and for IPv6 outside `2000::/3`. Use it to refuse internal addresses before your server connects to an address a user gave.

An [IPv4-mapped address](../glossary.md), such as `::ffff:127.0.0.1`, answers these questions as its IPv4 address: its `isLoopback` is `true`. So do `64:ff9b::/96` and `2002::/16` addresses for `isGlobal`.

`IpAddress` and the IPv4-mapped address that carries it are not `equals()`: `192.0.2.1` and `::ffff:192.0.2.1` are different addresses.

## Ipv4Address

`AnyString` › `IpAddress` › `Ipv4Address`

An IPv4 address, like `192.0.2.1`. It has the members of `IpAddress`.

| Property    | Value                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', format: 'ipv4', minLength: 7, maxLength: 15, pattern }`, with an example |
| Message     | `must be an IPv4 address (was a string of 3 characters)`                                    |

```ts
import { Ipv4Address } from '@horizon-republic/nominal-types';

new Ipv4Address('192.0.2.1').value; // '192.0.2.1'
new Ipv4Address('::1'); // throws NominalError: nominal.Ipv4Address: must be an IPv4 address (was a string of 3 characters)
```

## Ipv6Address

`AnyString` › `IpAddress` › `Ipv6Address`

An IPv6 address, like `2001:db8::1`. It has the members of `IpAddress`, and one more.

| Property    | Value                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', format: 'ipv6', minLength: 2, maxLength: 45, pattern }`, with an example |
| Message     | `must be an IPv6 address (was a string of 9 characters)`                                    |

```ts
import { Ipv6Address } from '@horizon-republic/nominal-types';

new Ipv6Address('2001:0DB8::0001').canonical().value; // '2001:db8::1'
new Ipv6Address('::ffff:192.0.2.1').toIpv4(); // Ipv4Address { value: '192.0.2.1' }
```

| Member     | Returns                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| `toIpv4()` | the `Ipv4Address` inside an IPv4-mapped address (`::ffff:…`), else `undefined` |

## IpPrefix

`AnyString` › `IpPrefix`

A network in [CIDR notation](../glossary.md), like `10.0.0.0/8` or `2001:db8::/32`.

- An address as `IpAddress` takes it, a `/`, and a prefix length: 0 to 32 for IPv4, 0 to 128 for IPv6, with no leading zeros.
- Every [host bit](../glossary.md) must be zero. `10.0.0.1/8` names one host, not a network, and is refused.

| Property    | Value                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', anyOf: [{ pattern }, { pattern }], minLength: 4, maxLength: 49 }`, with examples |
| Message     | `must be an IP prefix whose host bits are zero (was "10.0.0.1/8")`                                  |
| Limits      | the `pattern` can't check host bits, so the schema accepts `10.0.0.1/8`                             |

```ts
import { IpAddress, IpPrefix } from '@horizon-republic/nominal-types';

const network = new IpPrefix('10.0.0.0/8');

network.contains(new IpAddress('10.1.2.3')); // true
new IpPrefix('10.0.0.1/8'); // throws NominalError: nominal.IpPrefix: must be an IP prefix whose host bits are zero (was "10.0.0.1/8")
```

Members, with results for this `network`:

| Member            | Returns                                                                 | Example                           |
| ----------------- | ----------------------------------------------------------------------- | --------------------------------- |
| `version`         | `4` or `6`                                                              | `4`                               |
| `address`         | the first address of the network                                        | `IpAddress { value: '10.0.0.0' }` |
| `length`          | the prefix length                                                       | `8`                               |
| `contains(other)` | whether an `IpAddress`, or every address of an `IpPrefix`, is inside it | `true` for `10.1.2.3`             |
| `canonical()`     | the prefix with its address in the form of RFC 5952                     | `10.0.0.0/8`                      |
| `equals(other)`   | whether both are the same network, however they are written             |                                   |

`contains()` is `false` for an address of the other IP version, IPv4-mapped addresses included.

## Ipv4Prefix and Ipv6Prefix

`AnyString` › `IpPrefix` › `Ipv4Prefix`, `Ipv6Prefix`

A prefix of one IP version, like `192.168.0.0/16` or `2001:db8::/48`. They have the members of `IpPrefix`, and `address` is an `Ipv4Address` or an `Ipv6Address`.

| Property    | Value                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', minLength: 9, maxLength: 18, pattern }` for `Ipv4Prefix`, `minLength: 4, maxLength: 49` for `Ipv6Prefix`, with an example |
| Message     | `must be an IPv4 prefix whose host bits are zero (was "::/0")`, or the same for IPv6                                                         |

```ts
import { Ipv4Address, Ipv4Prefix, Ipv6Prefix } from '@horizon-republic/nominal-types';

new Ipv4Prefix('192.168.0.0/16').contains(new Ipv4Address('192.168.1.10')); // true
new Ipv6Prefix('2001:DB8:0::/48').canonical().value; // '2001:db8::/48'
```

## MacAddress

`AnyString` › `MacAddress`

A MAC address (EUI-48), like `00:00:5e:00:53:01`.

- Six pairs of hex digits, all separated by `:` or all by `-`. Upper and lower case are both accepted.
- Not accepted: mixed separators, no separators (`00005e005301`) and the dotted form (`0000.5e00.5301`).
- `value` keeps the text as given. `equals()` compares the bytes.
- `MacAddress` is a [sensitive type](../errors-and-messages.md#sensitive-types), since an address identifies a device.

| Property    | Value                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: MacAddress.pattern.source, minLength: 17, maxLength: 17 }`, with an example |
| Message     | `must be a MAC address (was a string of 17 characters)`                                                 |

```ts
import { MacAddress } from '@horizon-republic/nominal-types';

const mac = new MacAddress('00-00-5E-00-53-01');

mac.canonical().value; // '00:00:5e:00:53:01'
mac.equals(new MacAddress('00:00:5e:00:53:01')); // true
```

| Member                  | Returns                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `toBytes()`             | the six bytes as a `Uint8Array`                                                    |
| `isMulticast`           | whether the lowest bit of the first byte is set: a group address                   |
| `isLocallyAdministered` | whether the second lowest bit is set: an address set locally, such as a random one |
| `canonical()`           | the address in lowercase with colons                                               |
| `equals(other)`         | whether both have the same bytes, whatever the case and separator                  |

| Static field         | Holds                     |
| -------------------- | ------------------------- |
| `MacAddress.pattern` | the address as a `RegExp` |

## Isbn

`AnyString` › `Isbn`

A book number ([ISBN](../glossary.md)) like `9780306406157`: an ISBN-13, or an ISBN-10 as older books carry it. The last character is a [check digit](../glossary.md).

- Digits only. An ISBN-10 may end in `X`, upper case only.
- An ISBN-13 starts with `978` or `979`. It can't start with `9790`, which is a number for printed music.
- Hyphens and spaces are refused, with their own message. Remove them before you check the value: `text.replaceAll(/[\s-]/gu, '')`.
- `value` keeps the form as given. `equals()` finds an ISBN-10 equal to its ISBN-13.

| Property    | Value                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Isbn.pattern.source, minLength: 10, maxLength: 13 }`, with examples |
| Message     | `must be an ISBN with a valid check digit (was "9780306406158")`                                |
| Message     | `must be an ISBN without hyphens or spaces (was "978-0-306-40615-7")`                           |
| Limits      | the `pattern` can't compute the check digit, so the schema accepts `9780306406158`              |

```ts
import { Isbn } from '@horizon-republic/nominal-types';

const isbn = new Isbn('0306406152');

isbn.canonical().value; // '9780306406157'
isbn.equals(new Isbn('9780306406157')); // true
new Isbn('978-0-306-40615-7'); // throws NominalError: nominal.Isbn: must be an ISBN without hyphens or spaces (was "978-0-306-40615-7")
```

Members, with results for this `isbn`:

| Member          | Returns                                                     | Example                    |
| --------------- | ----------------------------------------------------------- | -------------------------- |
| `format`        | `10` or `13`, the number of characters                      | `10`                       |
| `canonical()`   | the ISBN-13                                                 | `9780306406157`            |
| `toIsbn10()`    | the ISBN-10; `undefined` for an ISBN that starts with `979` | `0306406152`               |
| `equals(other)` | whether both are the same ISBN, as an ISBN-10 or ISBN-13    | `true` for `9780306406157` |

| Static field   | Holds                                                       |
| -------------- | ----------------------------------------------------------- |
| `Isbn.pattern` | the shape of an ISBN as a `RegExp`, without the check digit |

## Issn

`AnyString` › `Issn`

A number for a journal or another serial ([ISSN](../glossary.md)) like `0378-5955`. The last character is a [check digit](../glossary.md).

- Four digits, a hyphen, three digits and a check digit. The check digit may be `X`, upper case only.
- The hyphen is required: `03785955` is refused.

| Property    | Value                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Issn.pattern.source, minLength: 9, maxLength: 9 }`, with an example |
| Message     | `must be an ISSN with a valid check digit (was "0378-5956")`                                    |
| Limits      | the `pattern` can't compute the check digit, so the schema accepts `0378-5956`                  |

```ts
import { Issn } from '@horizon-republic/nominal-types';

new Issn('2434-561X').value; // '2434-561X'
new Issn('0378-5956'); // throws NominalError: nominal.Issn: must be an ISSN with a valid check digit (was "0378-5956")
```

| Static field   | Holds                                                       |
| -------------- | ----------------------------------------------------------- |
| `Issn.pattern` | the shape of an ISSN as a `RegExp`, without the check digit |

## Gtin

`AnyString` › `Gtin`

The number under a product's bar code ([GTIN](../glossary.md)), like `4006381333931`. EAN and UPC numbers are GTINs. The last digit is a [check digit](../glossary.md).

- Digits only: 8, 12, 13 or 14 of them.
- `value` keeps the length as given. A shorter GTIN is the same number with zeros in front, so `equals()` finds `036000291452` equal to `0036000291452`.
- Only the check digit is checked. All zeros, such as `00000000`, is accepted.

| Property    | Value                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------ |
| JSON Schema | `{ type: 'string', pattern: Gtin.pattern.source, minLength: 8, maxLength: 14 }`, with an example |
| Message     | `must be a GTIN with a valid check digit (was "4006381333932")`                                  |
| Limits      | the `pattern` can't compute the check digit, so the schema accepts `4006381333932`               |

```ts
import { Gtin } from '@horizon-republic/nominal-types';

const gtin = new Gtin('036000291452');

gtin.format; // 12
gtin.canonical().value; // '00036000291452'
```

Members, with results for this `gtin`:

| Member          | Returns                                                       | Example                    |
| --------------- | ------------------------------------------------------------- | -------------------------- |
| `format`        | `8`, `12`, `13` or `14`, the number of digits                 | `12`                       |
| `canonical()`   | the 14-digit form with zeros in front, to store in a database | `00036000291452`           |
| `equals(other)` | whether both are the same number, whatever their length       | `true` for `0036000291452` |

| Static field   | Holds                                                      |
| -------------- | ---------------------------------------------------------- |
| `Gtin.pattern` | the shape of a GTIN as a `RegExp`, without the check digit |

## Isin

`AnyString` › `Isin`

A number for a share, a bond or another security ([ISIN](../glossary.md)), like `US0378331005`. The last digit is a [check digit](../glossary.md).

- Two letters, nine letters or digits, and a check digit: 12 characters.
- Upper case only: `us0378331005` is refused.
- The two letters are a country code, or a code such as `XS` for international securities. They are not checked against the list of countries.

| Property    | Value                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Isin.pattern.source, minLength: 12, maxLength: 12 }`, with an example |
| Message     | `must be an ISIN with a valid check digit (was "US0378331006")`                                   |
| Limits      | the `pattern` can't compute the check digit, so the schema accepts `US0378331006`                 |

```ts
import { Isin } from '@horizon-republic/nominal-types';

const isin = new Isin('US0378331005');

isin.prefix; // 'US'
isin.nsin; // '037833100'
```

| Member   | Returns                                                               | Example       |
| -------- | --------------------------------------------------------------------- | ------------- |
| `prefix` | the two letters in front                                              | `'US'`        |
| `nsin`   | the nine characters before the check digit: the number in its country | `'037833100'` |

| Static field   | Holds                                                       |
| -------------- | ----------------------------------------------------------- |
| `Isin.pattern` | the shape of an ISIN as a `RegExp`, without the check digit |

## Iban

`AnyString` › `Iban`

A bank account number as an [IBAN](../glossary.md), like `GB82WEST12345698765432`: a country code, two [check digits](../glossary.md) and the account number in that country.

- Upper case letters and digits, without spaces. This is the form IBANs take in files and APIs.
- The country is one of the 89 in the IBAN registry of SWIFT, release 101. The package carries this list. A territory that uses the IBAN of its country starts with that country's code: `FR` for French Guiana, `FI` for Åland, `GB` for Jersey.
- The length and the shape of the account number are the ones the registry gives the country: 22 characters for `GB` and `DE`, 15 for `NO`.
- The check digits are checked. The type doesn't know whether the bank or the account exists.
- Spaces and hyphens are refused, with their own message. To read an IBAN as people write it, remove the spaces and raise the case first: `text.replaceAll(' ', '').toUpperCase()`.

| Property    | Value                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Iban.pattern.source, minLength: 15, maxLength: 34 }`, with an example                                                                           |
| Message     | `must be an IBAN with valid check digits (was a string of 22 characters)`. `Iban` is a [sensitive type](../errors-and-messages.md#sensitive-types), so the value is hidden. |
| Message     | `must be an IBAN without spaces (was a string of 27 characters)`                                                                                                            |
| Limits      | the `pattern` doesn't know the countries or compute the check digits, so the schema accepts `GB83WEST12345698765432`                                                        |

```ts
import { Iban } from '@horizon-republic/nominal-types';

const iban = new Iban('GB82WEST12345698765432');

iban.toPrint(); // 'GB82 WEST 1234 5698 7654 32'
new Iban('GB82 WEST 1234 5698 7654 32'); // throws NominalError: nominal.Iban: must be an IBAN without spaces (was a string of 27 characters)
```

Members, with results for this `iban`:

| Member        | Returns                                                  | Example                         |
| ------------- | -------------------------------------------------------- | ------------------------------- |
| `countryCode` | the two letters in front                                 | `'GB'`                          |
| `checkDigits` | the two digits after the country code                    | `'82'`                          |
| `bban`        | the account number in its country: everything after them | `'WEST12345698765432'`          |
| `toPrint()`   | groups of four characters with spaces, to show to people | `'GB82 WEST 1234 5698 7654 32'` |

| Static field        | Holds                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| `Iban.countryCodes` | every accepted country code, in alphabetical order                      |
| `Iban.pattern`      | the shape of any IBAN as a `RegExp`, without the country rules or check |

## Bic

`AnyString` › `Bic`

A bank as its [BIC](../glossary.md), the SWIFT code, like `DEUTDEFF` or `DEUTDEFF500`.

- Four letters for the bank, a country code, two letters or digits for the place, and an optional branch of three letters or digits: 8 or 11 characters.
- Upper case only: `deutdeff` is refused.
- The country is one that `CountryCode` accepts, `XK` included.
- The type doesn't know whether SWIFT has issued the code.
- `value` keeps the form as given. A BIC of 8 characters names the main office, the same as the branch `XXX`, so `equals()` finds `DEUTDEFF` equal to `DEUTDEFFXXX`.

| Property    | Value                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Bic.pattern.source, minLength: 8, maxLength: 11 }`, with examples |
| Message     | `must be a BIC (was "deutdeff")`                                                              |
| Limits      | the `pattern` doesn't know the countries, so the schema accepts `DEUTZZFF`                    |

```ts
import { Bic } from '@horizon-republic/nominal-types';

const bic = new Bic('DEUTDEFF');

bic.canonical().value; // 'DEUTDEFFXXX'
bic.equals(new Bic('DEUTDEFFXXX')); // true
```

Members, with results for this `bic`:

| Member            | Returns                                                    | Example                  |
| ----------------- | ---------------------------------------------------------- | ------------------------ |
| `institution`     | the four letters of the bank                               | `'DEUT'`                 |
| `countryCode`     | the country code                                           | `'DE'`                   |
| `location`        | the two characters of the place                            | `'FF'`                   |
| `branch`          | the three characters of the branch; `'XXX'` for 8          | `'XXX'`                  |
| `isPrimaryOffice` | whether it names the main office: 8 characters, or `XXX`   | `true`                   |
| `canonical()`     | the 11 characters, with `XXX` for the main office          | `DEUTDEFFXXX`            |
| `equals(other)`   | whether both name the same office, with 8 or 11 characters | `true` for `DEUTDEFFXXX` |

| Static field  | Holds                                                 |
| ------------- | ----------------------------------------------------- |
| `Bic.pattern` | the shape of a BIC as a `RegExp`, without the country |

[← Built-in types](README.md)
