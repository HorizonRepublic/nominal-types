# Built-in types

## Email

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

## Uuid

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

## Url

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

## HttpUrl

A `Url` whose scheme is `http` or `https`, a subtype of `Url`: every `HttpUrl` is a `Url`, while a `Url` is not necessarily an `HttpUrl`.

```ts
new HttpUrl('https://example.com'); // fine
new HttpUrl('mailto:jane@example.com'); // throws NominalError
```

[← Documentation](../README.md)
