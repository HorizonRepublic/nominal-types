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

## Email

`AnyString` › `Email`

An email address like `jane.doe+news@example.com`.

- Up to 64 characters before the `@`, and up to 254 in total.
- A `+tag` before the `@` is understood, see the `tag` member.
- Not accepted: quoted names (`"jane"@example.com`), IP addresses (`jane@[127.0.0.1]`) and non-Latin domains. Convert a non-Latin domain to punycode first (`xn--…`).

| Property    | Value                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Email.pattern.source, format: 'email', minLength: 6, maxLength: 254 }`, with an example                                         |
| Message     | `must be an email address (was a string of 1 character)`. `Email` is a [sensitive type](../errors-and-messages.md#sensitive-types), so the value is hidden. |

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

## Url

`AnyString` › `Url`

An absolute URL like `https://example.com/a?b=1`: anything `new URL(text)` accepts.

- Any scheme is accepted, including `mailto:` and `javascript:`. Use `HttpUrl` for web addresses only.
- `value` keeps the text as given. The members read the parsed URL.

| Property    | Value                                                            |
| ----------- | ---------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', format: 'uri' }`, with an example             |
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

| Property    | Value                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| JSON Schema | `allOf` of `Url`'s and `{ type: 'string', pattern: '^[Hh][Tt][Tt][Pp][Ss]?:\\/\\/' }`, with an example |
| Message     | `must be an http or https URL (was "mailto:jane@example.com")`                                         |

```ts
import { HttpUrl } from '@horizon-republic/nominal-types';

new HttpUrl('https://example.com').value; // 'https://example.com'
new HttpUrl('mailto:jane@example.com'); // throws NominalError: nominal.HttpUrl: must be an http or https URL (was "mailto:jane@example.com")
```

## CountryCode

`AnyString` › `CountryCode`

A country or territory as its two-letter [ISO 3166-1](../glossary.md) code, like `US` or `UA`.

- The 249 codes officially assigned as of 8 October 2026. The package carries this list, so the Node version doesn't change it.
- Upper case only: `us` is refused.
- Reserved codes are refused: `UK` (write `GB`), `EU` and `XK`.

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

To accept a code outside the list, such as `XK`, declare your own type from `CountryCode.codes`:

```ts
import { AnyString, CountryCode } from '@horizon-republic/nominal-types';

const codes = [...CountryCode.codes, 'XK'].join('|');

class Region extends AnyString.subtype('geo.Region', new RegExp(`^(?:${codes})$`, 'u')) {}

new Region('XK').value; // 'XK'
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
  | Property | Value | | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | JSON Schema | `{ type: 'string', pattern: MediaType.pattern.source, minLength: 3 }`, with examples. The pattern accepts a parameter name given twice; the type refuses it. |
  | Message | `must be a media type (was "*/*")` |
  import { MediaType } from '@horizon-republic/nominal-types';
  const type = new MediaType('Application/LD+JSON; Charset="utf-8"');
  type.essence; // 'application/ld+json'
  type.isJson; // true
  Members, with results for this `type`:
  | Member | Returns | Example | | --------------- | ------------------------------------------------------------------------------ | ----------------------------------- |
  | `type` | the type as written | `'Application'` |
  | `subtype` | the subtype as written | `'LD+JSON'` |
  | `suffix` | what follows the last `+` of the subtype, or `undefined` | `'JSON'` |
  | `essence` | the type and subtype in lowercase, without parameters | `'application/ld+json'` |
  | `parameters` | a new `Map` of the parameters: names in lowercase, values without quotes | `Map { 'charset' => 'utf-8' }` |
  | `charset` | the `charset` parameter, or `undefined` | `'utf-8'` |
  | `isJson` | whether it is `application/json` or its subtype ends in `+json` | `true` |
  | `canonical()` | names in lowercase, no spaces, quotes only where a value needs them | `application/ld+json;charset=utf-8` |
  | `equals(other)` | compares the canonical forms: the case of names, spaces and quotes don't count | `true` for the `canonical()` value |
  Parameter values keep their case. `text/html;charset=UTF-8` doesn't equal `text/html;charset=utf-8`.
  | Static field | Holds | | ------------------- | ------------------------------------------------------------ |
  | `MediaType.pattern` | the media type as a `RegExp`, without the repeated-name rule |

## HexColor

`AnyString` › `HexColor`
A CSS color in hex notation like `#1e90ff`.

- A `#`, then 3, 4, 6 or 8 hex digits: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.
- Upper and lower case are both accepted and kept as given.
- The `#` is required, so `fff` is refused.
  | Property | Value | | ----------- | --------------------------------------------------------------------------------------------------- |
  | JSON Schema | `{ type: 'string', pattern: HexColor.pattern.source, minLength: 4, maxLength: 9 }`, with an example |
  | Message | `must be a hex color (was "fff")` |
  import { HexColor } from '@horizon-republic/nominal-types';
  const color = new HexColor('#1E90FF80');
  color.red; // 30
  color.canonical().value; // '#1e90ff80'
  Members, with results for this `color`:
  | Member | Returns | Example | | ---------------------- | ------------------------------------------------------------- | ----------------------- |
  | `red`, `green`, `blue` | a channel, from 0 to 255 | `30`, `144`, `255` |
  | `alpha` | the opacity, from 0 to 1; 1 when the color has no alpha digit | `0.5019607843137255` |
  | `canonical()` | `#` and 6 lowercase digits, or 8 when not fully opaque | `#1e90ff80` |
  | `equals(other)` | compares the channels | `#FFF` equals `#ffffff` |
  | Static field | Holds | | ------------------ | -------------------------- |
  | `HexColor.pattern` | the notation as a `RegExp` |

## Base64

`AnyString` › `Base64`
Bytes written as [base64](../glossary.md) text like `aGVsbG8=`.

- Letters, digits, `+` and `/`, in groups of four characters.
- The last group ends in `=` or `==` when it is short: `Zg==`, `Zm8=`.
- The bits the `=` fills must be zero, so each byte string has one text. `QR==` is refused; `QQ==` is the same byte.
- Not accepted: a missing `=`, spaces, line breaks and the `-_` characters of `Base64Url`.
- The empty string is accepted. It holds zero bytes.
  | Property | Value | | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
  | JSON Schema | `{ type: 'string', pattern: Base64.pattern.source, contentEncoding: 'base64' }`, with an example. For `openapi-3.0`, `format: 'byte'` in its place. |
  | Message | `must be base64 text (was "QQ")` |
  import { Base64 } from '@horizon-republic/nominal-types';
  const data = new Base64('aGVsbG8=');
  data.byteLength; // 5
  new TextDecoder().decode(data.toBytes()); // 'hello'
  | Member | Returns | Example | | --------------- | ------------------------------------------------- | -------------------------------------- |
  | `byteLength` | the number of bytes | `5` |
  | `toBytes()` | the bytes, in a new `Uint8Array` each call | `Uint8Array [104, 101, 108, 108, 111]` |
  | `equals(other)` | compares the text, which is the same as the bytes | |
  | Static field | Holds | | ---------------- | -------------------------- |
  | `Base64.pattern` | the encoding as a `RegExp` |
  `Base64` has no size limit. To cap the size, or to refuse the empty string, declare a subtype:
  import { Base64, matching } from '@horizon-republic/nominal-types';
  class Avatar extends Base64.subtype(
  'profile.Avatar',
  matching(/^.{4,1000000}$/u, 'from 1 to 750,000 bytes'),
  ) {}
  Avatar.parse(''); // { ok: false, issues: [{ message: 'must be from 1 to 750,000 bytes (was "")' }] }

## Base64Url

`AnyString` › `Base64Url`
Bytes written as base64url text like `aGVsbG8`: the [base64](../glossary.md) form that URLs and JSON Web Tokens use.

- Letters, digits, `-` and `_`.
- No `=` at the end: `Zg`, not `Zg==`. Remove the `=` first if a source adds it.
- The bits the last character fills must be zero, as for `Base64`.
- The empty string is accepted.
  `Base64Url` is a [sibling](../glossary.md) of `Base64`, not a subtype. Their characters differ, so neither accepts every text of the other.
  | Property | Value | | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
  | JSON Schema | `{ type: 'string', pattern: Base64Url.pattern.source, contentEncoding: 'base64url' }`, with an example. For `openapi-3.0`, no `contentEncoding`. |
  | Message | `must be base64url text (was "Zg==")` |
  import { Base64Url } from '@horizon-republic/nominal-types';
  const token = new Base64Url('aGVsbG8');
  token.byteLength; // 5
  new TextDecoder().decode(token.toBytes()); // 'hello'
  It has the members and the static field of `Base64`.

[← Built-in types](README.md)
