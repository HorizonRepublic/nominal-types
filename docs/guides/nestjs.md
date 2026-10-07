# NestJS

`@horizon-republic/nominal-types/adapters/nest` provides `NominalPipe` for Nest 11 and 12. `@nestjs/common` is an optional peer dependency, so the core installs nothing from Nest.

## Every parameter at once

Bind the pipe globally and declare parameters with a nominal type. Nest reflects the type from the handler signature, and the pipe turns the value into an instance:

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

Arguments declared with any other type pass through untouched, so the global pipe sits safely next to other pipes. It relies on `emitDecoratorMetadata`, which Nest projects enable anyway.

## One parameter

Pass the type explicitly, whatever the parameter is declared as:

```ts
@Get()
search(@Query('email', new NominalPipe(Email)) email: Email) {}
```

## Errors

A rejected value fails the request with a 400 in the shape of Nest's own Standard Schema pipe:

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["id: must be a UUID (was \"nope\")"] }
```

Shape it differently with `exceptionFactory`, globally or per parameter:

```ts
new NominalPipe({
  exceptionFactory: (issues) => new UnprocessableEntityException(issues),
});

new NominalPipe(Email, {
  exceptionFactory: (issues, metadata) => new BadRequestException(`${metadata.data} is invalid`),
});
```

## Headers

Nest runs no pipes on `@Headers()`, so validate header values in the handler with `parse()`.

[← Documentation](../README.md)
