# How to validate NestJS route parameters

This guide shows how to turn route parameters, query values and bodies into nominal types with `NominalPipe`, on Nest 11 or 12. The pipe comes from `@horizon-republic/nominal-types/adapters/nest`; `@nestjs/common` is an optional peer dependency, so the core installs nothing from Nest.

## Validating every parameter

Bind the pipe globally and declare parameters with a nominal type. The pipe turns each such value into an instance:

```ts
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

app.useGlobalPipes(new NominalPipe());
```

```ts
@Controller('users')
export class UsersController {
  @Get(':id')
  find(@Param('id') id: Uuid) {
    return id.version; // an instance, already validated
  }
}
```

Arguments declared with any other type pass through untouched, so the global pipe can sit next to other pipes. It reads the declared type through `emitDecoratorMetadata`, which Nest projects enable by default.

## Validating one parameter

To validate one parameter, or one declared with another type, pass the type to the pipe:

```ts
@Get()
search(@Query('email', new NominalPipe(Email)) email: Email) {}
```

## Shaping the error response

By default, a rejected value fails the request with a 400 in the shape of Nest's own Standard Schema pipe:

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["id: must be a UUID (was \"nope\")"] }
```

To answer differently, pass `exceptionFactory`, globally or per parameter:

```ts
new NominalPipe({
  exceptionFactory: (issues) => new UnprocessableEntityException(issues),
});

new NominalPipe(Email, {
  exceptionFactory: (issues, metadata) => new BadRequestException(`${metadata.data} is invalid`),
});
```

## Validating headers

Nest runs no pipes on `@Headers()`. Validate header values in the handler with `parse()`, as in [How to validate untrusted input](validating-input.md).

[← Documentation](../README.md)
