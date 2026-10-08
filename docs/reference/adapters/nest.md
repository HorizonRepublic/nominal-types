# nest

Entry point: `@horizon-republic/nominal-types/adapters/nest`. Needs `@nestjs/common` 11 or 12; `NominalResponse` also needs `rxjs` 7.2 or later, which Nest apps already have.

| Export                         | Kind      | Use it for                                                     |
| ------------------------------ | --------- | -------------------------------------------------------------- |
| `NominalPipe`                  | class     | a Nest pipe that turns route arguments into instances          |
| `NominalSerializerInterceptor` | class     | a `ClassSerializerInterceptor` that writes instances as values |
| `NominalResponse`              | decorator | a route's response written by a schema's `stringify()`         |
| `NominalResponseInterceptor`   | class     | the interceptor behind `NominalResponse`                       |
| `nestLogger`                   | function  | the package's warnings written by Nest's `Logger`              |
| `NominalPipeOptions`           | type      | the options of `NominalPipe`                                   |
| `NominalPipeTarget`            | type      | what `NominalPipe` checks against                              |
| `NominalExceptionFactory`      | type      | a function that builds the error for rejected input            |
| `NominalResponseSchema`        | type      | what `NominalResponse` writes with                             |

## NominalPipe

```ts
new NominalPipe(options?: NominalPipeOptions);
new NominalPipe(target: NominalPipeTarget, options?: NominalPipeOptions);
```

| Parameter | Type                                                                                                                    | Description                                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`  | nominal type, `n.of()` or `n.object()` schema, or any synchronous Standard Schema (such as `fromArk()` or a Zod object) | optional; what to check the argument against. An asynchronous schema throws `TypeError: NominalPipe: asynchronous schemas are not supported` |
| `options` | `NominalPipeOptions`                                                                                                    | optional; see [Options](#options)                                                                                                            |

### What it checks

With a `target`, the pipe checks every argument against it.

Without one, it picks the target per argument, in this order:

1. the parameter's `{ schema }` option on Nest 12, when it is a nominal type or an `n.of()` schema;
2. the type the parameter is declared with, when it is a nominal type, or an `n.of()` or `n.object()` schema that Bun and SWC record for a type named like the schema;
3. nothing: the argument passes through untouched.

So a global `new NominalPipe()` is safe beside other pipes. It leaves DTO classes and schemas of other libraries alone.

The declared type comes from `emitDecoratorMetadata`. That metadata loses array items and `?`:

- a parameter declared as `Uuid[]` is not checked; use `n.of(Uuid).array()`;
- a missing value of a declared type passes on as `undefined`, so declare the parameter with `?`;
- a parameter declared as `PositiveInteger | undefined` is not checked; write `page?: PositiveInteger`.

A pipe with a `target`, or a nominal type or `n.of()` schema in `{ schema }`, decides whether a value may be missing. Under a global pipe, `new NominalPipe(PositiveInteger)` on a parameter rejects a missing value, and `new NominalPipe(n.of(Email).optional())` lets it through. This works on Nest 11 and 12.

### Query strings and route parameters

| Input                               | What the pipe does                                               |
| ----------------------------------- | ---------------------------------------------------------------- |
| `'2'` for a number or boolean type  | reads it as `2` (`'true'` as `true`), unless `fromString: false` |
| `'02'` or `'abc'` for a number type | rejects it: `page: must be a number (was "02")`                  |
| `?ids=a` for an array schema        | wraps the lone value: `['a']`                                    |
| a string for an `n.of()` schema     | reads text only through the schema's own `fromString()`          |

Bodies are never read from strings. Nest runs no pipes on `@Headers()`.

### Options

| Option             | Type                          | Default                                        | Description                                                                                                                          |
| ------------------ | ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `fromString`       | `boolean`                     | `true`                                         | read query and route strings as the value of a number or boolean type                                                                |
| `hideValues`       | `boolean`                     | `false`                                        | leave rejected values out of every message, before `exceptionFactory` sees them. [Sensitive types](../glossary.md) hide them anyway. |
| `exceptionFactory` | `(issues, metadata) => Error` | a `BadRequestException`, see [Errors](#errors) | builds the error the request fails with                                                                                              |

`exceptionFactory` gets the issues (`{ message, path? }[]`) and Nest's `ArgumentMetadata`. It works on a global pipe and on a pipe for one parameter.

### Errors

By default the request fails with status 400 and this body:

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["ids.1: must be a UUID (was \"nope\")"] }
```

Each message is `<parameter>: <type message>`. A list item adds its index.

In a microservice, Nest hides an HTTP exception behind `Internal server error`. Pass an `exceptionFactory` that returns an `RpcException`.

## Example

A controller, with `app.useGlobalPipes(new NominalPipe())` in `main.ts`:

```ts
// orders.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

@Controller('orders')
export class OrdersController {
  @Get(':id')
  find(@Param('id') id: Uuid) {
    return id.value; // GET /orders/nope → 400, "id: must be a UUID (was \"nope\")"
  }

  @Get()
  list(
    @Query('ids', new NominalPipe(n.of(Uuid).array({ max: 100 }))) ids: readonly Uuid[],
    @Query('page') page?: PositiveInteger, // '?page=2' arrives as 2, no page as undefined
  ) {
    return { page: page?.value ?? 1, ids: ids.length };
  }
}
```

The options:

```ts
import { UnprocessableEntityException } from '@nestjs/common';
import { Uuid } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

const hidden = new NominalPipe(Uuid, { hideValues: true });
hidden.transform('nope', { type: 'param', data: 'id' });
// throws BadRequestException:
// { statusCode: 400, error: 'Bad Request', message: ['id: must be a UUID (was a string of 4 characters)'] }

const custom = new NominalPipe(Uuid, {
  exceptionFactory: (issues) => new UnprocessableEntityException(issues),
});
custom.transform('nope', { type: 'param', data: 'id' });
// throws UnprocessableEntityException:
// { message: [{ message: 'must be a UUID (was "nope")' }], error: 'Unprocessable Entity', statusCode: 422 }
```

## NominalSerializerInterceptor

```ts
new NominalSerializerInterceptor(reflector: Reflector, defaultOptions?: ClassSerializerInterceptorOptions);
```

Extends Nest's `ClassSerializerInterceptor` and takes the same arguments. Needs class-transformer, as `ClassSerializerInterceptor` does.

`ClassSerializerInterceptor` writes an instance as `{ "value": … }`, because class-transformer ignores `toJSON()`. This interceptor first replaces every instance in the response with its `toJSON()`: in lists, plain objects and class instances, at any depth. Then class-transformer runs as before, with `@Exclude()`, `@Expose()`, groups and `@SerializeOptions()`.

| Response                                   | Answer                                  |
| ------------------------------------------ | --------------------------------------- |
| `new Email('jane@example.com')`            | `jane@example.com`                      |
| `{ email: new Email('jane@example.com') }` | `{"email":"jane@example.com"}`          |
| `[new PositiveInteger(1)]`                 | `[1]`                                   |
| an object without instances                | what `ClassSerializerInterceptor` gives |

The response itself is not changed. An object that holds an instance is copied with its class, so a getter on it reads the plain value: in `get domain() { return this.email.domain; }`, `this.email` is a string. The copy has no `#private` fields, so a getter that reads one throws `TypeError: Cannot read private member`.

```ts
// main.ts
import { NestFactory, Reflector } from '@nestjs/core';
import { NominalSerializerInterceptor } from '@horizon-republic/nominal-types/adapters/nest';

import { AppModule } from './app.module';

const app = await NestFactory.create(AppModule);
app.useGlobalInterceptors(new NominalSerializerInterceptor(app.get(Reflector)));
await app.listen(3000);
```

## NominalResponse

```ts
NominalResponse(schema: NominalResponseSchema<Value>): MethodDecorator & ClassDecorator;
```

| Parameter | Type                                                  | Description                     |
| --------- | ----------------------------------------------------- | ------------------------------- |
| `schema`  | an `n.of()` or `n.object()` schema, or a nominal type | what to write the response with |

It writes what the route returns with [`schema.stringify()`](../schemas.md#stringify), or [`Type.stringify()`](../type-members.md#stringify) for a nominal type. It sends the text with the header `content-type: application/json; charset=utf-8`. It works on Express and on Fastify.

| Route                                     | Answer                                                     |
| ----------------------------------------- | ---------------------------------------------------------- |
| returns a value, or a promise of one      | the JSON text of the value                                 |
| throws, such as a `NotFoundException`     | the error, as Nest writes it                               |
| on a Fastify route with a response schema | the JSON text of the value; Fastify doesn't write it again |
| in a microservice                         | the value as it is                                         |

The route must return a value of the schema's shape. An object keeps only the fields the schema declares.

A global `NominalSerializerInterceptor` leaves the text alone, so the two work together.

On a whole controller, use the interceptor: `@UseInterceptors(new NominalResponseInterceptor(schema))`. It takes the same `schema`.

`NominalResponseSchema<Value>` is any object with `stringify(value: Value): string`.

```ts
// orders.controller.ts
import { Controller, Get } from '@nestjs/common';
import { AnyBoolean, n, Uuid } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';
import { NominalResponse } from '@horizon-republic/nominal-types/adapters/nest';

const Order = n.object({ id: Uuid, paid: AnyBoolean });

@Controller('orders')
export class OrdersController {
  @Get('latest')
  @NominalResponse(Order)
  public latest(): ValueOf<typeof Order> {
    const order = Order.parse({ id: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', paid: false });

    if (!order.ok) {
      throw new Error('bad order');
    }

    return order.value; // {"id":"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f","paid":false}
  }
}
```

It needs `rxjs`, which every Nest app has.

## nestLogger()

```ts
nestLogger(logger?: LoggerService): Logger
```

| Parameter | Type            | Description                                                                  |
| --------- | --------------- | ---------------------------------------------------------------------------- |
| `logger`  | `LoggerService` | optional; the Nest logger to write to. Default: `new Logger('NominalTypes')` |

Returns: a [`Logger`](../configure.md#logger-interface) for `n.configure({ logger })`.

It calls `logger.warn(message, details)` and `logger.debug(message, details)`, as Nest's loggers take them. A warning without details is written as `logger.warn(message)`.

The default `Logger` writes through the logger the app uses at the time of each entry, so `n.configure()` can run before `NestFactory.create()`, and `app.useLogger()` still applies.

With `debug`, Nest writes each argument `NominalPipe` rejects. See [logger](../configure.md#logger).

```ts
// nominal.config.ts
import { n } from '@horizon-republic/nominal-types';
import { nestLogger } from '@horizon-republic/nominal-types/adapters/nest';

n.configure({ logger: nestLogger() });
```

## See also

- [How to validate NestJS requests](../../guides/frameworks/nestjs.md)
- [class-validator](class-validator.md), for DTO properties
- [Errors and messages](../errors-and-messages.md)

[← Adapters](README.md) · [← Reference](../README.md)
