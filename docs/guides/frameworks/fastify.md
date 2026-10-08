# How to use nominal types with Fastify

The `fastifyNominal` plugin checks request bodies, route parameters, query strings and headers with the schemas in a route's `schema`. Your handler gets instances, such as an `Email`, or Fastify answers with status 400. Responses are written with the schema's `stringify()`.

## Before you start

- Install the package and Fastify:

  ```sh
  npm install @horizon-republic/nominal-types fastify
  ```

- The plugin comes from the adapter's entry point, `@horizon-republic/nominal-types/adapters/fastify`. It works with Fastify 5.
- The types of `request.body` and `request.query` come from `NominalTypeProvider`. A type provider is what tells Fastify's TypeScript types the type of a schema's value.

## Quick example

This server takes an order as the request body:

```ts
// server.ts
import Fastify from 'fastify';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
import { fastifyNominal } from '@horizon-republic/nominal-types/adapters/fastify';
import type { NominalTypeProvider } from '@horizon-republic/nominal-types/adapters/fastify';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

const app = Fastify().withTypeProvider<NominalTypeProvider>();

await app.register(fastifyNominal);

app.post('/orders', { schema: { body: CreateOrder } }, (request) => ({
  domain: request.body.customer.domain, // request.body.customer is an Email
}));

await app.listen({ port: 3000 });
```

A body with `"customer": "jane"` gets this answer:

```json
{
  "statusCode": 400,
  "code": "FST_ERR_VALIDATION",
  "error": "Bad Request",
  "message": "body/customer must be an email address (was a string of 4 characters)"
}
```

## Check a request body

1. Describe the body with [n.object()](../core/check-an-object.md):

   ```ts
   // create-order.ts
   import { AnyString, Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

   export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

   export const CreateOrder = n.object({
     customer: Email,
     sku: Sku,
     quantity: PositiveInteger,
     note: n.of(AnyString).optional(),
   });
   ```

2. Register the plugin before the routes, and give the schema to the route as `body`:

   ```ts
   // server.ts
   import Fastify from 'fastify';
   import { fastifyNominal } from '@horizon-republic/nominal-types/adapters/fastify';
   import type { NominalTypeProvider } from '@horizon-republic/nominal-types/adapters/fastify';

   import { CreateOrder } from './create-order.ts';

   const app = Fastify().withTypeProvider<NominalTypeProvider>();

   await app.register(fastifyNominal);

   app.post('/orders', { schema: { body: CreateOrder } }, (request) => ({
     domain: request.body.customer.domain,
     sku: request.body.sku.value,
     quantity: request.body.quantity.value,
   }));
   ```

3. Send a good body. The handler gets instances:

   ```text
   POST /orders {"customer":"jane@example.com","sku":"ABC-1234","quantity":2}
   200 {"domain":"example.com","sku":"ABC-1234","quantity":2}
   ```

4. Send a bad body. The answer lists every bad field:

   ```text
   POST /orders {"customer":"jane","sku":"abc","quantity":0}
   400 {"statusCode":400,"code":"FST_ERR_VALIDATION","error":"Bad Request","message":
     "body/customer must be an email address (was a string of 4 characters),
      body/sku must be matched by ^[A-Z]{3}-\\d{4}$ (was \"abc\"),
      body/quantity must be a positive integer (was 0)"}
   ```

   A missing field gets a message too: `body/quantity is required`. The `note` field may be missing, because its schema is `optional()`.

To check one field against another, such as two dates in order, add a constraint to the schema. See [How to check one field against another](../core/check-fields-together.md).

## Check route parameters, query strings and headers

Give each part an `n.object()` schema. These parts arrive as text, so the plugin reads numbers and booleans first: `'2'` becomes `2`, `'false'` becomes `false`.

```ts
// users.ts
import Fastify from 'fastify';
import { AnyBoolean, n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
import { fastifyNominal } from '@horizon-republic/nominal-types/adapters/fastify';
import type { NominalTypeProvider } from '@horizon-republic/nominal-types/adapters/fastify';

const app = Fastify().withTypeProvider<NominalTypeProvider>();

await app.register(fastifyNominal);

app.get('/users/:id', { schema: { params: n.object({ id: Uuid }) } }, (request) => ({
  id: request.params.id.value,
  isUuid: request.params.id instanceof Uuid,
}));

const Search = n.object({ page: PositiveInteger, active: AnyBoolean }).partial();

app.get('/users', { schema: { querystring: Search } }, (request) => ({
  page: request.query.page?.value ?? 1,
  active: request.query.active?.value ?? true,
}));

app.get('/me', { schema: { headers: n.object({ 'x-request-id': Uuid }) } }, (request) => ({
  requestId: request.headers['x-request-id'].value,
}));
```

The answers:

```text
GET /users/0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f  200 {"id":"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f","isUuid":true}
GET /users/nope                                  400 … "message":"params/id must be a UUID (was \"nope\")"
GET /users?page=2&active=false                   200 {"page":2,"active":false}
GET /users?page=02                               400 … "message":"querystring/page must be a number (was \"02\")"
GET /users                                       200 {"page":1,"active":true}
GET /me  (x-request-id: nope)                    400 … "message":"headers/x-request-id must be a UUID (was \"nope\")"
```

What to know:

- `partial()` makes every field optional and keeps it readable from text. See [How to check a request body with n.object()](../core/check-an-object.md).
- Write header names in lower case, as Node.js gives them.
- To turn text reading off, pass `{ fromString: false }` to `register()`. Then `?page=2` gets `querystring/page must be a number (was "2")`.

## Lists and optional values

A list in a query string is a field of [n.of()](../core/lists-and-optional-values.md) with `array()`:

```ts
// orders.ts
import Fastify from 'fastify';
import { Email, n, Uuid } from '@horizon-republic/nominal-types';
import { fastifyNominal } from '@horizon-republic/nominal-types/adapters/fastify';
import type { NominalTypeProvider } from '@horizon-republic/nominal-types/adapters/fastify';

const app = Fastify().withTypeProvider<NominalTypeProvider>();

await app.register(fastifyNominal);

const Search = n.object({
  ids: n.of(Uuid).array({ max: 100 }),
  email: n.of(Email).optional(),
});

app.get('/orders', { schema: { querystring: Search } }, (request) => ({
  ids: request.query.ids.map((id) => id.value),
  email: request.query.email?.value ?? 'none',
}));
```

The answers:

```text
GET /orders?ids=0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f            200 {"ids":["0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"],"email":"none"}
GET /orders?ids=0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f&ids=nope   400 … "message":"querystring/ids/1 must be a UUID (was \"nope\")"
GET /orders                                                    400 … "message":"querystring/ids is required"
```

Two details about lists:

- `?ids=a` gives one string, not a list. The plugin turns it into a list of one.
- Items of an `n.of()` schema are read from text only if you ask: `n.of(PositiveInteger).fromString().array()`.

## Send responses

Give the response a schema by status code. The plugin writes the value with the schema's [`stringify()`](../../reference/schemas.md#stringify), which is faster than `JSON.stringify()` of instances:

```ts
// latest-order.ts
import Fastify from 'fastify';
import { AnyBoolean, n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
import { fastifyNominal } from '@horizon-republic/nominal-types/adapters/fastify';
import type { NominalTypeProvider } from '@horizon-republic/nominal-types/adapters/fastify';

const Order = n.object({ id: Uuid, quantity: PositiveInteger, paid: AnyBoolean });

const app = Fastify().withTypeProvider<NominalTypeProvider>();

await app.register(fastifyNominal);

app.get('/orders/latest', { schema: { response: { 200: Order } } }, () => {
  const order = Order.parse({ id: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', quantity: 2, paid: false });

  if (!order.ok) {
    throw new Error('no order');
  }

  return order.value; // GET /orders/latest → 200 {"id":"0190f1c2-…","quantity":2,"paid":false}
});
```

What to know:

- The answer has only the fields the schema declares, in the order it declares them.
- With `NominalTypeProvider`, the handler must return the schema's value: instances, not plain strings.
- A list takes the array schema: `200: Order.array()`. A single instance takes its type: `200: Uuid`.
- A status code with a plain JSON Schema is written by Fastify, as before.

## Show the routes in Swagger

`@fastify/swagger` reads the JSON Schema of each nominal schema. It needs no option:

```ts
// server.ts
import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
import { fastifyNominal } from '@horizon-republic/nominal-types/adapters/fastify';
import type { NominalTypeProvider } from '@horizon-republic/nominal-types/adapters/fastify';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

const app = Fastify().withTypeProvider<NominalTypeProvider>();

await app.register(swagger, { openapi: { info: { title: 'Shop', version: '1.0.0' } } });
await app.register(fastifyNominal, { jsonSchemaTarget: 'openapi-3.0' });

app.post('/orders', { schema: { body: CreateOrder } }, (request) => ({
  domain: request.body.customer.domain,
}));

await app.ready();

app.swagger(); // the body: { type: 'object', properties: { customer: { type: 'string', format: 'email', … }, … } }
```

`jsonSchemaTarget: 'openapi-3.0'` writes the schemas in the keywords of OpenAPI 3.0, the version `@fastify/swagger` writes by default. Leave it out for draft-07, Fastify's own dialect.

## Errors

A rejected value fails the request with Fastify's validation error, status 400. The message names the part and the path of each bad value, joined by `, `:

```json
{
  "statusCode": 400,
  "code": "FST_ERR_VALIDATION",
  "error": "Bad Request",
  "message": "querystring/ids/1 must be a UUID (was \"nope\")"
}
```

`error.validation` holds each issue in the shape of an Ajv error, so `attachValidation`, `schemaErrorFormatter` and `setErrorHandler()` work as they do without the plugin. To answer with something else, set an error handler:

```ts
// server.ts
import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import { n, Uuid } from '@horizon-republic/nominal-types';
import { fastifyNominal } from '@horizon-republic/nominal-types/adapters/fastify';
import type { NominalTypeProvider } from '@horizon-republic/nominal-types/adapters/fastify';

const app = Fastify().withTypeProvider<NominalTypeProvider>();

await app.register(fastifyNominal, { hideValues: true });

app.setErrorHandler<FastifyError>((error, _request, reply) => {
  if (error.validation === undefined) {
    return reply.send(error);
  }

  return reply.code(422).send({ issues: error.validation.map((issue) => issue.message) });
});

app.get('/users/:id', { schema: { params: n.object({ id: Uuid }) } }, (request) => ({
  id: request.params.id.value,
}));
// GET /users/nope → 422 {"issues":["must be a UUID (was a string of 4 characters)"]}
```

`hideValues: true` keeps rejected values out of answers and logs. A [sensitive type](../../reference/glossary.md) leaves its values out even without it. See [How to keep values out of error messages](../core/hide-values.md).

## Limits

- Register the plugin before the routes. A route added before it is checked, but `@fastify/swagger` shows its schema wrong.
- Register it at the top, or in the plugin that holds the routes. A route in a sibling plugin gets Fastify's own compilers, and `ready()` fails with `FST_ERR_SCH_VALIDATION_BUILD`.
- A route's own `validatorCompiler` or `serializerCompiler` option replaces the plugin's on that route.
- A request without a body arrives as `null`: `body must be an object (was null)`. To allow no body, use `CreateOrder.optional()`.
- A type that can't describe itself as JSON Schema, such as one built with `n.satisfying()`, shows `{}` in Swagger. The plugin still checks it.

## See also

- [Fastify adapter reference](../../reference/adapters/fastify.md): every option, the error shape and the compilers on their own.
- [How to check a request body with n.object()](../core/check-an-object.md)
- [How to read numbers and booleans from text](../core/read-text-values.md)
- [How to use nominal types with NestJS](nestjs.md), which runs on Fastify too.

[← Guides](../README.md)
