# How to use nominal types with NestJS

`NominalPipe` checks request bodies, route parameters, query values and message payloads. Your handler gets instances, such as an `Email`, or Nest answers with status 400.

What to write depends on your Nest version. Run `npm ls @nestjs/common` to see it.

| Task                                    | Nest 11                                    | Nest 12                                                            |
| --------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| a request body                          | `@Body(new NominalPipe(CreateOrder))`      | the same, or `@Body({ schema: CreateOrder })` with the global pipe |
| a route parameter or a query value      | the global pipe, and the parameter's type  | the same                                                           |
| a list, or a value that must be present | `new NominalPipe(schema)` on the parameter | the same; for a list, also `{ schema }` with the global pipe       |
| a message payload                       | `@Payload(new NominalPipe(Type))`          | the same                                                           |

## Before you start

- Install the package and the peer dependency (a package you install yourself):

  ```sh
  npm install @horizon-republic/nominal-types @nestjs/common
  ```

- The pipe comes from the adapter's entry point, `@horizon-republic/nominal-types/adapters/nest`. Nothing from Nest loads unless you import it.
- It works with Nest 11 and 12, on Express and on Fastify.
- Nest 12 ships as ES modules only. A CommonJS app loads it with `require()`, which Node.js supports for ES modules from version 22.12.
- The global pipe needs `emitDecoratorMetadata` in `tsconfig.json`. A project made with the Nest CLI has it on.

## Quick example

This controller takes an order as the request body:

```ts
// orders.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });
type CreateOrderBody = ValueOf<typeof CreateOrder>;

@Controller('orders')
export class OrdersController {
  @Post()
  public create(@Body(new NominalPipe(CreateOrder)) order: CreateOrderBody) {
    return { domain: order.customer.domain }; // order.customer is an Email
  }
}
```

A body with `"customer": "jane"` gets this answer:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["customer: must be an email address (was a string of 4 characters)"]
}
```

## Check a request body

New project? Check bodies with [n.object()](../core/check-an-object.md). Use [class-validator](../validators/class-validator.md) instead if your DTOs already use it.

1. Describe the body in its own file. Give the type of a checked body its own name, such as `CreateOrderBody`. A type named like the schema breaks Swagger and pipes under Bun and SWC; see [Limits](#limits).

   ```ts
   // create-order.ts
   import { AnyString, Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
   import type { ValueOf } from '@horizon-republic/nominal-types';

   export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

   export const CreateOrder = n.object({
     customer: Email,
     sku: Sku,
     quantity: PositiveInteger,
     note: n.of(AnyString).optional(),
   });

   export type CreateOrderBody = ValueOf<typeof CreateOrder>;
   ```

   `ValueOf` gives the type of a checked body. It takes the place of a DTO class (a class that describes a request body).

2. Put the pipe on `@Body()` and give it the schema:

   ```ts
   // orders.controller.ts
   import { Body, Controller, Post } from '@nestjs/common';
   import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

   import { CreateOrder, type CreateOrderBody } from './create-order';

   @Controller('orders')
   export class OrdersController {
     @Post()
     public create(@Body(new NominalPipe(CreateOrder)) order: CreateOrderBody) {
       return {
         domain: order.customer.domain, // order.customer is an Email
         sku: order.sku.value,
         quantity: order.quantity.value,
       };
     }
   }
   ```

3. Send a good body. The handler gets instances:

   ```text
   POST /orders {"customer":"jane@example.com","sku":"ABC-1234","quantity":2}
   201 {"domain":"example.com","sku":"ABC-1234","quantity":2}
   ```

4. Send a bad body. The answer lists every bad field:

   ```text
   POST /orders {"customer":"jane","sku":"abc","quantity":0}
   400 {"statusCode":400,"error":"Bad Request","message":[
     "customer: must be an email address (was a string of 4 characters)",
     "sku: must be matched by ^[A-Z]{3}-\\d{4}$ (was \"abc\")",
     "quantity: must be a positive integer (was 0)"]}
   ```

   A missing field gets a message too: `quantity: is required`. The `note` field may be missing, because its schema is `optional()`.

On Nest 12 you can put the schema in the decorator instead. The global pipe from [Check route parameters and query values](#check-route-parameters-and-query-values) reads it:

```ts
// orders.controller.ts (Nest 12)
import { Body, Controller, Post } from '@nestjs/common';

import { CreateOrder, type CreateOrderBody } from './create-order';

@Controller('orders')
export class OrdersController {
  @Post()
  public create(@Body({ schema: CreateOrder }) order: CreateOrderBody) {
    return { domain: order.customer.domain };
  }
}
```

Without the global pipe, Nest doesn't check `{ schema }`, and the handler gets the raw body.

To check one field against another, such as two dates in order, add a constraint to the schema. See [How to check one field against another](../core/check-fields-together.md).

Swagger doesn't see a body behind `NominalPipe`. To show it, add `@ApiNominalBody(CreateOrder)` to the route; see [How to document nominal types in Swagger](../api-docs/swagger.md#document-a-request-body).

## Check route parameters and query values

1. Register the pipe once, for every controller. Do it in `main.ts`, after `NestFactory.create()`:

   ```ts
   // main.ts
   import { NestFactory } from '@nestjs/core';
   import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

   import { AppModule } from './app.module';

   async function bootstrap() {
     const app = await NestFactory.create(AppModule);
     app.useGlobalPipes(new NominalPipe());
     await app.listen(3000);
   }

   void bootstrap();
   ```

2. Declare each parameter with a nominal type:

   ```ts
   // users.controller.ts
   import { Controller, Get, Param, Query } from '@nestjs/common';
   import { AnyBoolean, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

   @Controller('users')
   export class UsersController {
     @Get(':id')
     public find(@Param('id') id: Uuid) {
       return { id: id.value, isUuid: id instanceof Uuid };
     }

     @Get()
     public list(@Query('page') page?: PositiveInteger, @Query('active') active?: AnyBoolean) {
       return { page: page?.value ?? 1, active: active?.value ?? true };
     }
   }
   ```

3. Call the routes:

   ```text
   GET /users/0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f  200 {"id":"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f","isUuid":true}
   GET /users/nope                                  400 {"statusCode":400,"error":"Bad Request","message":["id: must be a UUID (was \"nope\")"]}
   GET /users?page=2&active=true                    200 {"page":2,"active":true}
   GET /users?page=02&active=true                   400 {"statusCode":400,"error":"Bad Request","message":["page: must be a number (was \"02\")"]}
   GET /users                                       200 {"page":1,"active":true}
   ```

What the global pipe does:

- It checks a parameter only when its type is a nominal type, or when it has a `{ schema }` on Nest 12. It leaves every other parameter alone, so it is safe next to your other pipes.
- Route and query values arrive as text. For number and boolean types, the pipe reads the text first: `'2'` becomes `2`, `'true'` becomes `true`. See [How to read numbers and booleans from strings](../core/read-text-values.md).
- To turn that off, pass `new NominalPipe({ fromString: false })`. Then `?active=true` gets `active: must be a boolean (was "true")`.
- A missing value reaches the handler as `undefined`. The parameter's type can't say whether the value is required, so declare it with `?`.

To require a value, give the parameter a pipe of its own: `@Query('page', new NominalPipe(PositiveInteger)) page: PositiveInteger`. Then `GET /users` gets `page: must be a number (was undefined)`. Such a pipe also checks a parameter without the global pipe.

## Lists and optional values

The parameter's type can't show `Uuid[]`. Describe a list, or a value that may be missing, with [n.of()](../core/lists-and-optional-values.md). Give the schema to a pipe on the parameter:

```ts
// users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { Email, n, Uuid } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

@Controller('users')
export class UsersController {
  @Get()
  public search(
    @Query('ids', new NominalPipe(n.of(Uuid).array({ max: 100 }))) ids: readonly Uuid[],
    @Query('email', new NominalPipe(n.of(Email).optional())) email?: Email,
  ) {
    return { ids: ids.map((id) => id.value), email: email?.value ?? 'none' };
  }
}
```

On Nest 12, you can put the schema in the decorator instead, and keep the global pipe from `main.ts`:

```ts
// users.controller.ts (Nest 12)
import { Controller, Get, Query } from '@nestjs/common';
import { Email, n, Uuid } from '@horizon-republic/nominal-types';

@Controller('users')
export class UsersController {
  @Get()
  public search(
    @Query('ids', { schema: n.of(Uuid).array({ max: 100 }) }) ids: readonly Uuid[],
    @Query('email', { schema: n.of(Email).optional() }) email?: Email,
  ) {
    return { ids: ids.map((id) => id.value), email: email?.value ?? 'none' };
  }
}
```

Both give the same answers:

```text
GET /users?ids=0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f            200 {"ids":["0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"],"email":"none"}
GET /users?ids=0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f&ids=nope   400 {"statusCode":400,"error":"Bad Request","message":["ids.1: must be a UUID (was \"nope\")"]}
GET /users                                                    400 {"statusCode":400,"error":"Bad Request","message":["ids: must be an array (was undefined)"]}
```

Two details about lists in a query string, the same on Express and Fastify:

- `?ids=a` gives one string, not a list. The pipe turns it into a list of one.
- Items of a schema are read from text only if you ask: `n.of(PositiveInteger).fromString().array()`. Then `?pages=1&pages=x` gets `pages.1: must be a number (was "x")`.

## Check message payloads

In a microservice, put the pipe on `@Payload()`. Answer with an `RpcException`, so the client sees the issues:

```ts
// users.handler.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { Uuid } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

const checkId = new NominalPipe(Uuid, {
  exceptionFactory: (issues) => new RpcException({ issues }),
});

@Controller()
export class UsersHandler {
  @MessagePattern('user.find')
  public find(@Payload(checkId) id: Uuid) {
    return { id: id.value };
  }
}
```

The client sending `'nope'` gets this error:

```json
{ "issues": [{ "message": "must be a UUID (was \"nope\")" }] }
```

Without `exceptionFactory`, the client gets only `{ "status": "error", "message": "Internal server error" }`.

## Send instances in responses

Without an interceptor, Nest writes each instance with its `toJSON()`. An `Email` becomes `"jane@example.com"`.

Nest's `ClassSerializerInterceptor` runs class-transformer, which ignores `toJSON()`. It writes each instance as `{ "value": … }`. Use `NominalSerializerInterceptor` in its place. It takes the same arguments and options, and it needs class-transformer too:

```ts
// main.ts
import { NestFactory, Reflector } from '@nestjs/core';
import { NominalSerializerInterceptor } from '@horizon-republic/nominal-types/adapters/nest';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new NominalSerializerInterceptor(app.get(Reflector)));
  await app.listen(3000);
}

void bootstrap();
```

`@Exclude()`, `@Expose()`, groups and `@SerializeOptions()` work as before:

```ts
// users.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Exclude } from 'class-transformer';
import { AnyString, Email, Uuid } from '@horizon-republic/nominal-types';

export class User {
  @Exclude()
  public password: AnyString;

  public constructor(
    public id: Uuid,
    public email: Email,
    password: AnyString,
  ) {
    this.password = password;
  }
}

@Controller('users')
export class UsersController {
  @Get('me')
  public me(): User {
    const id = new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');

    return new User(id, new Email('jane@example.com'), new AnyString('secret'));
  }
}
```

The answers:

```text
ClassSerializerInterceptor     200 {"id":{"value":"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"},"email":{"value":"jane@example.com"}}
NominalSerializerInterceptor   200 {"id":"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f","email":"jane@example.com"}
```

## Send responses fast

When a route always returns the same shape, let its schema write the answer. `@NominalResponse()` writes the value with the schema's [`stringify()`](../../reference/schemas.md#stringify). That is several times faster than Nest's `JSON.stringify()` of instances. It works on Express and on Fastify.

1. Describe the answer with `n.object()`, or reuse the schema you parse with:

   ```ts
   // order.ts
   import { AnyBoolean, n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
   import type { ValueOf } from '@horizon-republic/nominal-types';

   export const Order = n.object({ id: Uuid, quantity: PositiveInteger, paid: AnyBoolean });

   export type OrderValue = ValueOf<typeof Order>;
   ```

2. Put `@NominalResponse(Order)` on the route, and return a value the schema gave:

   ```ts
   // orders.controller.ts
   import { Controller, Get, NotFoundException } from '@nestjs/common';
   import { NominalResponse } from '@horizon-republic/nominal-types/adapters/nest';

   import { Order, type OrderValue } from './order';

   @Controller('orders')
   export class OrdersController {
     @Get('latest')
     @NominalResponse(Order)
     public latest(): OrderValue {
       const order = Order.parse({
         id: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
         quantity: 2,
         paid: false,
       });

       if (!order.ok) {
         throw new NotFoundException();
       }

       return order.value;
     }
   }
   ```

3. Call the route:

   ```text
   GET /orders/latest  200 {"id":"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f","quantity":2,"paid":false}
   ```

What to know:

- The answer has only the fields the schema declares, in the order it declares them.
- A list takes the array schema: `@NominalResponse(Order.array())`. A single instance takes its type: `@NominalResponse(Uuid)`.
- An error the route throws is answered by Nest as usual.
- A global `NominalSerializerInterceptor` leaves these answers alone. Keep it for routes without a schema.
- For every route of a controller, put `@UseInterceptors(new NominalResponseInterceptor(Order))` on the class.

## Send instances from a route with a Fastify response schema

On Fastify, a route with a response schema, set with `@RouteSchema()`, is not written by `JSON.stringify()`. Fastify's own writer reads instances wrong:

- an `AnyBoolean` that holds `false` is written as `true`;
- a nullable field, such as `n.of(Email).nullable()`, fails with status 500;
- a date or time type, such as `Instant`, fails with status 500.

`@NominalResponse()` from [Send responses fast](#send-responses-fast) fixes these routes: Fastify sends its text as it is. `NominalSerializerInterceptor` fixes them too, since it turns instances into plain values before Fastify writes them. Without either, return plain values from the handler with the schema's [`toPlain()`](../../reference/schemas.md#toplain):

```ts
// orders.controller.ts
import { Controller, Get } from '@nestjs/common';
import { RouteSchema } from '@nestjs/platform-fastify';
import { AnyBoolean, n, Uuid } from '@horizon-republic/nominal-types';

const Order = n.object({ id: Uuid, paid: AnyBoolean });
const orderJson = Order['~standard'].jsonSchema.output({ target: 'draft-07' });

@Controller('orders')
export class OrdersController {
  @Get('latest')
  @RouteSchema({ response: { 200: orderJson } })
  public latest() {
    const order = Order.parse({ id: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', paid: false });

    return order.ok ? Order.toPlain(order.value) : undefined; // {"id":"0190f1c2-…","paid":false}
  }
}
```

Returning `order.value` itself writes `"paid":true`. For a value that doesn't come from one schema, use [`n.plain()`](../../reference/schemas.md#nplain).

## Errors

A rejected value fails the request with status 400. The body has the same shape as the one from Nest's own validation. Each message starts with where the value was: the parameter name, the field, or the list index.

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["ids.1: must be a UUID (was \"nope\")"] }
```

To answer with something else, pass `exceptionFactory`. It works on the global pipe and on a pipe for one parameter:

```ts
// orders.controller.ts
import { Body, Controller, Post, UnprocessableEntityException } from '@nestjs/common';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

import { CreateOrder, type CreateOrderBody } from './create-order';

const checkOrder = new NominalPipe(CreateOrder, {
  exceptionFactory: (issues) => new UnprocessableEntityException({ issues }),
});

@Controller('orders')
export class OrdersController {
  @Post()
  public create(@Body(checkOrder) order: CreateOrderBody) {
    return { sku: order.sku.value };
  }
}
```

A body with `"customer": "jane"` now gets status 422:

```json
{ "issues": [{ "message": "must be an email address (was a string of 4 characters)", "path": ["customer"] }] }
```

To keep rejected values out of answers and logs, pass `hideValues: true`, as in `app.useGlobalPipes(new NominalPipe({ hideValues: true }))`. Then `?ids=…&ids=nope` gets `ids.1: must be a UUID (was a string of 4 characters)`. A [sensitive type](../../reference/glossary.md) leaves its values out even without it. See [How to keep values out of error messages](../core/hide-values.md).

## Limits

- Write `page?: PositiveInteger`, not `page: PositiveInteger | undefined`. TypeScript records the second as `Object`, so the global pipe doesn't check it.
- The global pipe doesn't check a parameter declared `Uuid[]`. TypeScript records only `Array` for it, so `?ids=nope&ids=nope` reaches the handler as plain strings. Use a schema, as in [Lists and optional values](#lists-and-optional-values).
- `@Body() order: CreateOrderBody` with no pipe and no `{ schema }` is not checked. `CreateOrderBody` is a type, not a class, so the global pipe can't see it.
- Give the type of a schema's value its own name, as in `type CreateOrderBody = ValueOf<typeof CreateOrder>`. Bun and SWC record the schema itself as the type of `order: CreateOrder` when the schema and the type share the name. The global `NominalPipe` then checks the body. But `@nestjs/swagger` writes a broken `$ref` (`#/components/schemas/`), and a global `ValidationPipe` answers with status 500.
- Under `NominalSerializerInterceptor`, a getter that class-transformer calls sees values, not instances. In `@Expose() get domain() { return this.email.domain; }`, `this.email` is a string, so `domain` is left out of the answer. Set such a value in a plain field instead.
- Under `NominalSerializerInterceptor`, the copy of an object that holds an instance has no `#private` fields. A getter or method that reads one, such as `@Expose() get hint() { return this.#hint; }`, throws `TypeError: Cannot read private member #hint from an object whose class did not declare it`, and the request fails with status 500. Use a plain field, or a `private` field without `#`.
- Nest doesn't run pipes on `@Headers()`. Check a header inside the handler with `parse()`:

  ```ts
  // users.controller.ts
  import { BadRequestException, Controller, Get, Headers } from '@nestjs/common';
  import { Uuid } from '@horizon-republic/nominal-types';

  @Controller('users')
  export class UsersController {
    @Get('me')
    public me(@Headers('x-request-id') header: string | undefined) {
      const parsed = Uuid.parse(header);

      if (!parsed.ok) {
        throw new BadRequestException(parsed.issues); // 400, "message": [{ "message": "must be a UUID (was \"nope\")" }]
      }

      return { requestId: parsed.value.value }; // parsed.value is a Uuid
    }
  }
  ```

  See [How to check untrusted input](../core/check-input.md).

## See also

- [NestJS adapter reference](../../reference/adapters/nest.md): every option of `NominalPipe`, with defaults, and `NominalResponse`.
- [Performance](../../explanation/performance.md#writing-responses-as-json), for what each way of writing a response costs.
- [How to check a request body with n.object()](../core/check-an-object.md)
- [How to describe types in Swagger](../api-docs/swagger.md)
- [How to use nominal types with GraphQL](graphql.md)
- [Where checks belong](../../explanation/where-checks-belong.md), for body size limits and other checks Nest does before the pipe.

[← Guides](../README.md)
