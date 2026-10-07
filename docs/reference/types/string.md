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

An email address in the dot-atom form RFC 5322 defines, at most 64 characters before the `@` and 254 in all, with plus addressing understood. Quoted local parts, IP-literal domains and Unicode domains are rejected; a Unicode domain passes once converted to punycode.

| Property    | Value                                               |
| ----------- | --------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Email.pattern.source }` |
| Message     | `must be an email address (was "x")`                |

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

A UUID in its 8-4-4-4-12 text form: versions 1 to 8, the nil and the max value, in either case.

| Property    | Value                                              |
| ----------- | -------------------------------------------------- |
| JSON Schema | `{ type: 'string', pattern: Uuid.pattern.source }` |
| Message     | `must be a UUID (was "x")`                         |

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

An absolute URL as the WHATWG URL standard parses it, with any scheme, `mailto:` and `javascript:` included. The value keeps the text as given, while the accessors read the parsed form.

| Property    | Value                                                            |
| ----------- | ---------------------------------------------------------------- |
| JSON Schema | `{ type: 'string', format: 'uri' }`                              |
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

| Property    | Value                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| JSON Schema | `allOf` of `Url`'s and `{ type: 'string', pattern: '^[Hh][Tt][Tt][Pp][Ss]?:\\/\\/' }` |
| Message     | `must be an http or https URL (was "mailto:jane@example.com")`                        |

```ts
new HttpUrl('https://example.com'); // fine
new HttpUrl('mailto:jane@example.com'); // throws NominalError
```

[← Built-in types](README.md)
