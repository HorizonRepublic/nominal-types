# How to use nominal types with Elysia

Elysia checks `body`, `params`, `query` and `response` with any [Standard Schema](../../reference/glossary.md). Give it a nominal schema, and the handler gets instances, such as an `Email`.

## Before you start

- Install the package and Elysia:

  ```sh
  npm install @horizon-republic/nominal-types elysia
  ```

- This page uses Elysia 1.4. No adapter is needed.

## Quick example

This app takes an order as the request body:

```ts
// app.ts
import { Elysia } from 'elysia';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

export const app = new Elysia().post(
  '/orders',
  ({ body, status }) => status(201, { domain: body.customer.domain, quantity: body.quantity.value }),
  { body: CreateOrder },
);
```

The answers:

```text
POST /orders {"customer":"jane@example.com","quantity":2}  201 {"domain":"example.com","quantity":2}
POST /orders {"customer":"jane","quantity":0}              422 {"type":"validation","on":"body","property":"customer",
  "message":"must be an email address (was a string of 4 characters)","found":{…},"errors":[…]}
```

## Check route parameters and query strings

Route parameters and query values arrive as text. Read numbers and booleans with [fromString()](../core/read-text-values.md):

```ts
// app.ts
import { Elysia } from 'elysia';
import { n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

const Page = n.object({ page: n.of(PositiveInteger).fromString().optional() });

export const app = new Elysia()
  .get('/users/:id', ({ params }) => ({ id: params.id.value, version: params.id.version }), {
    params: n.object({ id: Uuid }),
  })
  .get('/users', ({ query }) => ({ page: query.page?.value ?? 1 }), { query: Page });
```

The answers:

```text
GET /users/0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f  200 {"id":"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f","version":7}
GET /users/nope                                  422 … "message":"must be a UUID (was \"nope\")" …
GET /users?page=2                                200 {"page":2}
GET /users?page=02                               422 … "message":"must be a number (was \"02\")" …
GET /users                                       200 {"page":1}
```

## Check responses

Give `response` a schema, and return instances. Elysia checks the value and writes each instance with its `toJSON()`:

```ts
// app.ts
import { Elysia } from 'elysia';
import { AnyBoolean, Email, n } from '@horizon-republic/nominal-types';

const Contact = n.object({ email: Email, verified: AnyBoolean });

export const app = new Elysia().get(
  '/contact',
  () => ({ email: new Email('jane@example.com'), verified: new AnyBoolean(false) }),
  { response: Contact },
);
// GET /contact → 200 {"email":"jane@example.com","verified":false}
```

## Errors

Elysia answers a rejected value with status 422. The body names the first issue, lists every issue under `errors`, and holds the input under `found`. That echoes rejected values, passwords too. To answer with something else, handle the `VALIDATION` error:

```ts
// app.ts
import { Elysia } from 'elysia';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

export const app = new Elysia()
  .onError(({ code, error, status }) => {
    if (code === 'VALIDATION') {
      return status(400, { issues: error.all.map((issue) => issue.message) });
    }
  })
  .post('/orders', ({ body }) => ({ domain: body.customer.domain }), { body: CreateOrder });
// POST /orders {"customer":"jane","quantity":0}
// 400 {"issues":["must be an email address (was a string of 4 characters)","must be a positive integer (was 0)"]}
```

## Limits

- A class of your own with getters or methods: TypeScript doesn't see them on the handler's `body` until the class declares `StandardOf`. See [Classes with members of their own](../validators/standard-schema.md#classes-with-members-of-their-own).
- A query value read from text needs `n.of(Type).fromString()`. A plain `PositiveInteger` field gets `"2"` and refuses it.

## See also

- [How to check a request body with n.object()](../core/check-an-object.md)
- [How to read numbers and booleans from text](../core/read-text-values.md)
- [How to use a type in any Standard Schema library](../validators/standard-schema.md)

[← Guides](../README.md)
