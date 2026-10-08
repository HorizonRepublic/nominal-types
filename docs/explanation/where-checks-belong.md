# Where checks belong

Which part of an application should check input, and with which tool? This page explains why checks go at the edges of an application.

## Check at the boundary

A boundary is a place where data enters your code. Examples are an HTTP request, a queue message, an environment variable, a row read from a database and a GraphQL argument.

Data at a boundary is untrusted: treat it as `unknown`, whatever the sender promised. Turn it into nominal types there, once. Past the boundary, functions take `Email`, `Sku` and `PositiveInteger` and need no checks of their own.

This gives each input one place that checks it, and sends errors back to the sender, who can fix the input.

## Three kinds of checks

A request passes three kinds of checks:

| Kind      | What it checks                                                 | Done by                                                 |
| --------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| Transport | the size of the body, the URL and the headers                  | your HTTP server: Node.js, Express, Fastify             |
| Structure | which fields exist, which are required, lists and their length | `n.object()`, or ArkType, Zod, Valibot, class-validator |
| Value     | whether a value is really an `Email`, and what it can do       | nominal types                                           |

This package covers structure and value. `n.object()` says which fields an object has, and each field is a nominal type. One schema does both jobs:

```ts
import { AnyString, Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const CreateOrder = n.object({
  customer: Email,
  sku: Sku,
  quantity: PositiveInteger,
  note: n.of(AnyString).optional(),
});

const body: unknown = { customer: 'jane@example.com', quantity: 0, admin: true };

CreateOrder.parse(body);
// { ok: false, issues: [
//   { message: 'must be a string (was undefined)', path: ['sku'] },
//   { message: 'must be a positive integer (was 0)', path: ['quantity'] },
// ] }
```

It finds the missing `sku` and the bad `quantity` in one pass. Keys the schema doesn't list, such as `admin`, are dropped from the result.

## When another library checks the structure

`n.object()` has no unions of different object shapes, no recursive schemas, no transforms and no asynchronous checks. For those, ArkType checks the structure, and its adapter puts nominal types into its fields.

A project that already uses ArkType, Zod, Valibot or class-validator keeps it, with its adapter. [Choosing how to check input](choosing-an-approach.md) compares these ways.

## Lists, missing values and text

Some places take one schema for one value: a NestJS route parameter, or a field of another library's schema. `n.of()` gives such a place a list, an optional value or a `null`, built from a type: `n.of(Uuid).array()`.

Some transports carry only text: environment variables, query strings, CSV files. A number arrives there as `'3'`. `fromString()` reads it first:

```ts
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

PositiveInteger.parse('3'); // { ok: false, issues: [{ message: 'must be a number (was "3")' }] }
n.of(PositiveInteger).fromString().parse('3'); // { ok: true, value: PositiveInteger { value: 3 } }
```

Add `fromString()` only where the input is text. A type's rule never reads text by itself, so a JSON body that sends `"3"` for a number is refused.

## Size limits belong to the server

`array({ max })` limits one list, after the server has read and parsed the whole body. A huge body has cost memory and time by then. So set the size limit on the server, where it runs before your code:

- Fastify limits a body to 1 MB by default, set with `bodyLimit`.
- Express limits a JSON body with `express.json({ limit })`.
- Node.js limits the URL and the headers to 16 KB.

Keep both: the server's limit for the whole request, `array({ max })` for one list inside it.

## The database is a boundary too

A database can hold values written before a rule changed, or by other code. The ORM adapters check every value they read, and a value the type refuses throws a `NominalError`. The adapter's `trusted` option skips the check for a column you trust.

## Where each boundary gets its types

| Boundary                          | What turns plain input into nominal types                                                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| an HTTP request body or a message | [`n.object()`](../guides/core/check-an-object.md), or the adapter of a validator you already use                                                                                                   |
| a NestJS parameter or payload     | [`NominalPipe`](../guides/frameworks/nestjs.md)                                                                                                                                                    |
| a class-validator DTO             | [`@NominalField()`](../guides/validators/class-validator.md)                                                                                                                                       |
| a GraphQL argument                | a scalar from [`toGraphQL()`](../guides/frameworks/graphql.md)                                                                                                                                     |
| data sent through tRPC or Next.js | [`toSuperjson()`](../guides/frameworks/superjson.md)                                                                                                                                               |
| configuration                     | [`fromEnv()`](../guides/core/read-config.md)                                                                                                                                                       |
| a database row                    | the ORM adapter: [MikroORM](../guides/databases/mikro-orm.md), [TypeORM](../guides/databases/typeorm.md), [Drizzle](../guides/databases/drizzle.md), [Sequelize](../guides/databases/sequelize.md) |

## See also

- [How to check a request body with n.object()](../guides/core/check-an-object.md)
- [Choosing how to check input](choosing-an-approach.md)
- [How to accept lists, missing values and null](../guides/core/lists-and-optional-values.md)
- [How to read numbers and booleans from text](../guides/core/read-text-values.md)
- [Nominal types in domain-driven design](domain-driven-design.md)

[← Explanation](README.md)
