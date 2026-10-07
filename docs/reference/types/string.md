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
new AnyString('').value; // ''
```

## Email

`AnyString` › `Email`

An email address like `jane.doe+news@example.com`.

- Up to 64 characters before the `@`, and up to 254 in total.
- A `+tag` before the `@` is understood, see `tag` below.
- Not accepted: quoted names (`"jane"@example.com`), IP addresses (`jane@[127.0.0.1]`) and non-Latin domains. Convert a non-Latin domain to punycode first (`xn--…`).

| Property    | Value                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Email.pattern.source, format: 'email', minLength: 6, maxLength: 254 }`, with an example |
| Message     | `must be an email address (was "x")`                                                                                |

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

`equals()` compares the text exactly. `canonical()` and `isSameMailbox()` apply no provider rules, such as Gmail ignoring dots.

| Static field     | Holds                                                    |
| ---------------- | -------------------------------------------------------- |
| `Email.pattern`  | the whole address as a `RegExp`, with the length limits  |
| `Email.atom`     | one dot-separated piece of the local part, as a fragment |
| `Email.label`    | one domain label, as a fragment                          |
| `Email.topLevel` | the top-level domain, as a fragment                      |

## Uuid

`AnyString` › `Uuid`

A UUID like `0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f`.

- Versions 1 to 8, plus the all-zero and all-`f` values.
- Upper and lower case are both accepted and kept as given.

| Property    | Value                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Uuid.pattern.source, format: 'uuid', minLength: 36, maxLength: 36 }`, with an example |
| Message     | `must be a UUID (was "x")`                                                                                        |

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

| Static field   | Holds                  |
| -------------- | ---------------------- |
| `Uuid.pattern` | the UUID as a `RegExp` |

## Url

`AnyString` › `Url`

An absolute URL like `https://example.com/a?b=1`: anything `new URL(text)` accepts.

- Any scheme is accepted, including `mailto:` and `javascript:`. Use `HttpUrl` for web addresses only.
- `value` keeps the text as given. The members below read the parsed URL.

| Property    | Value                                                            |
| ----------- | ---------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', format: 'uri' }`, with an example             |
| Message     | `must be a URL (was "x")`, also for a value that is not a string |

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

## HttpUrl

`AnyString` › `Url` › `HttpUrl`

A `Url` whose scheme is `http` or `https`, in any case. It has the members of `Url`.

| Property    | Value                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| JSON Schema | `allOf` of `Url`'s and `{ type: 'string', pattern: '^[Hh][Tt][Tt][Pp][Ss]?:\\/\\/' }`, with an example |
| Message     | `must be an http or https URL (was "mailto:jane@example.com")`                                         |

```ts
new HttpUrl('https://example.com'); // fine
new HttpUrl('mailto:jane@example.com'); // throws NominalError
```

[← Built-in types](README.md)
