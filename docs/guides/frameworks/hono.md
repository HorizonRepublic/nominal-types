# How to use nominal types with Hono

Hono's `@hono/standard-validator` checks a request with any [Standard Schema](../../reference/glossary.md). Give it a nominal schema, and `c.req.valid()` returns instances, such as an `Email`.

## Before you start

- Install the package, Hono and its validator:

  ```sh
  npm install @horizon-republic/nominal-types hono @hono/standard-validator
  ```

- This page uses Hono 4 and `@hono/standard-validator` 0.4. No adapter is needed.

## Quick example

This app takes an order as the request body:

```ts
// app.ts
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

export const app = new Hono().post('/orders', sValidator('json', CreateOrder), (c) => {
  const order = c.req.valid('json');

  return c.json({ domain: order.customer.domain, quantity: order.quantity.value }, 201);
});
```

The answers:

```text
POST /orders {"customer":"jane@example.com","quantity":2}  201 {"domain":"example.com","quantity":2}
POST /orders {"customer":"jane","quantity":0}              400 {"data":{"customer":"jane","quantity":0},"error":[…],"success":false}
```

## Check route parameters and query strings

Route parameters and query values arrive as text. Read numbers and booleans with [fromString()](../core/read-text-values.md):

```ts
// app.ts
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

const Page = n.object({ page: n.of(PositiveInteger).fromString().optional() });

export const app = new Hono()
  .get('/users/:id', sValidator('param', n.object({ id: Uuid })), (c) => {
    const { id } = c.req.valid('param');

    return c.json({ id: id.value, version: id.version });
  })
  .get('/users', sValidator('query', Page), (c) => {
    const { page } = c.req.valid('query');

    return c.json({ page: page?.value ?? 1 });
  });
```

The answers:

```text
GET /users/0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f  200 {"id":"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f","version":7}
GET /users/nope                                  400 {"data":{"id":"nope"},"error":[{"message":"must be a UUID (was \"nope\")","path":["id"]}],"success":false}
GET /users?page=2                                200 {"page":2}
GET /users?page=02                               400 {"data":{"page":"02"},"error":[{"message":"must be a number (was \"02\")","path":["page"]}],"success":false}
GET /users                                       200 {"page":1}
```

## Errors

By default the validator answers status 400 with the issues under `error`, and the input itself under `data`. That echoes rejected values, passwords too. To answer with something else, pass a hook as the third argument:

```ts
// app.ts
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

export const app = new Hono().post(
  '/orders',
  sValidator('json', CreateOrder, (result, c) => {
    if (!result.success) {
      return c.json({ issues: result.error.map((issue) => issue.message) }, 400);
    }
  }),
  (c) => c.json({ domain: c.req.valid('json').customer.domain }, 201),
);
// POST /orders {"customer":"jane","quantity":0}
// 400 {"issues":["must be an email address (was a string of 4 characters)","must be a positive integer (was 0)"]}
```

## Limits

- A class of your own with getters or methods: TypeScript doesn't see them on `c.req.valid()` until the class declares `StandardOf`. See [Classes with members of their own](../validators/standard-schema.md#classes-with-members-of-their-own).
- A query value read from text needs `n.of(Type).fromString()`. A plain `PositiveInteger` field gets `"2"` and refuses it: `must be a number (was "2")`.

## See also

- [How to check a request body with n.object()](../core/check-an-object.md)
- [How to read numbers and booleans from text](../core/read-text-values.md)
- [How to use a type in any Standard Schema library](../validators/standard-schema.md)

[← Guides](../README.md)
