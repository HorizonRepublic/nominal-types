# How to validate NestJS route parameters

This guide shows how to turn route parameters and query values into nominal types with `NominalPipe`. It works on Nest 11 and 12.

The pipe comes from a separate entry point, `@horizon-republic/nominal-types/adapters/nest`. You only need `@nestjs/common` if you import it.

## Validating every parameter

Register the pipe once, globally:

```ts
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

app.useGlobalPipes(new NominalPipe());
```

Then declare parameters with a nominal type. The handler gets an instance that is already checked:

```ts
import { Controller, Get, Param } from '@nestjs/common';
import { Uuid } from '@horizon-republic/nominal-types';

@Controller('users')
export class UsersController {
  @Get(':id')
  find(@Param('id') id: Uuid) {
    return id.version; // id is a Uuid
  }
}
```

Parameters of any other type are left alone, so the pipe is safe next to your other pipes.

The pipe learns the parameter's type from `emitDecoratorMetadata`. A project made with the Nest CLI has it on already.

## Validating one parameter

Pass the type to the pipe:

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

A bad value fails the request with status 400. The body looks like the one from Nest's own validation:

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["id: must be a UUID (was \"nope\")"] }
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

## Validating headers

Nest doesn't run pipes on `@Headers()`. Check header values inside the handler with `parse()`, as shown in [How to validate untrusted input](validating-input.md).

[← Documentation](../README.md)
