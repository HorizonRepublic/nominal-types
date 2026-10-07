# How to validate NestJS route parameters

This guide shows how to turn route parameters, query values and message payloads into nominal types with `NominalPipe`. It works on Nest 11 and 12.

The pipe comes from a separate entry point, `@horizon-republic/nominal-types/adapters/nest`. You only need `@nestjs/common` if you import it.

## Validating every parameter

Register the pipe once, globally:

```ts
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

app.useGlobalPipes(new NominalPipe());
```

Then declare parameters with a nominal type. The handler gets an instance that is already checked:

```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

@Controller('users')
export class UsersController {
  @Get(':id')
  find(@Param('id') id: Uuid) {
    return id.version; // id is a Uuid
  }

  @Get()
  list(@Query('page') page: PositiveInteger) {
    return page.value; // '?page=2' arrives as the number 2
  }
}
```

How the global pipe treats values:

- Parameters of any other type are left alone, so it is safe next to your other pipes. That includes DTO classes: to check nominal properties of a DTO, use [class-validator](class-validator.md).
- Query and route values are always strings. For number and boolean types, the pipe reads them first: `'2'` becomes `2`, `'true'` becomes `true`. Text like `'abc'` or `'02'` is rejected with the type's message.
- The pipe learns each parameter's type from `emitDecoratorMetadata`. A project made with the Nest CLI has it on already.

To turn string reading off, pass `fromString: false`:

```ts
app.useGlobalPipes(new NominalPipe({ fromString: false }));
```

> **Warning:** TypeScript doesn't record array items or `?` in that metadata. A parameter declared as `Uuid[]` is not checked at all, and `email?: Email` is treated as required. Use a schema for both, as shown below.

## Validating lists and optional values

Describe the parameter with [`schemaOf()`](arrays-and-optional.md). How you attach the schema depends on the Nest version.

On Nest 12, put it in the decorator's `schema` option. The global pipe reads it:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { Email, schemaOf, Uuid } from '@horizon-republic/nominal-types';

@Controller('users')
export class UsersController {
  @Get()
  search(
    @Query('ids', { schema: schemaOf(Uuid).array({ max: 100 }) }) ids: readonly Uuid[],
    @Query('email', { schema: schemaOf(Email).optional() }) email?: Email,
  ) {}
}
```

On Nest 11, pass the schema to a pipe on the parameter, and don't register the pipe globally:

```ts
@Get()
search(
  @Query('ids', new NominalPipe(schemaOf(Uuid).array({ max: 100 }))) ids: readonly Uuid[],
  @Query('email', new NominalPipe(schemaOf(Email).optional())) email?: Email,
) {}
```

Why not globally on Nest 11: Nest runs global pipes before the pipes on a parameter. The global pipe would see `email: Email`, not know it's optional, and reject a missing value first.

Two details for lists in a query string, the same on Fastify and Express:

- `?ids=a` gives one string, not a list. The pipe turns it into a list of one.
- Items of a schema are read from strings only if you ask: `schemaOf(PositiveInteger).fromString().array()`.

## Validating one parameter

Pass the type or a schema to the pipe:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { Email } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

@Controller('users')
export class UsersController {
  @Get()
  search(@Query('email', new NominalPipe(Email)) email: Email) {}
}
```

## Shaping the error response

A bad value fails the request with status 400. The body looks like the one from Nest's own validation. A bad list item carries its index:

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["ids.1: must be a UUID (was \"nope\")"] }
```

To send something else, pass `exceptionFactory`. It works globally and for one parameter:

```ts
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';

new NominalPipe({
  exceptionFactory: (issues) => new UnprocessableEntityException(issues),
});

new NominalPipe(Email, {
  exceptionFactory: (issues, metadata) => new BadRequestException(`${metadata.data} is invalid`),
});
```

## Validating message payloads

In a microservice, put the pipe on `@Payload()` and answer with an `RpcException`:

```ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { Uuid } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

@Controller()
export class UsersHandler {
  @MessagePattern('user.find')
  find(@Payload(new NominalPipe(Uuid, { exceptionFactory: (issues) => new RpcException({ issues }) })) id: Uuid) {}
}
```

The client then gets `{ issues: [{ message: 'must be a UUID (was "nope")' }] }`. Without `exceptionFactory`, Nest hides the default 400 behind `Internal server error`, as it does for any HTTP exception in a microservice.

## Validating headers

Nest doesn't run pipes on `@Headers()`. Check header values inside the handler with `parse()`, as shown in [How to validate untrusted input](validating-input.md).

[← Guides](README.md)
