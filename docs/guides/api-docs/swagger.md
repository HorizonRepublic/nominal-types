# How to document nominal types in Swagger

Make `@nestjs/swagger` describe each nominal type with its pattern, format, length limits and example, instead of an empty object.

## Before you start

- Install Swagger for Nest: `npm install @nestjs/swagger`.
- The helpers come from the [adapter](../../reference/glossary.md) `@horizon-republic/nominal-types/adapters/swagger`. It is a separate [entry point](../../reference/glossary.md): you need `@nestjs/swagger` only if you import it.
- It works with `@nestjs/swagger` 11 and 12. It needs neither class-validator nor class-transformer.
- `@nestjs/swagger` 12 asks for TypeScript 5.5 to 6 as a peer dependency. With TypeScript 7, `npm install` stops with `ERESOLVE`. Let it use your TypeScript with an override in `package.json`:

  ```json
  {
    "overrides": {
      "@nestjs/swagger": {
        "typescript": "$typescript"
      }
    }
  }
  ```

  `$typescript` stands for the version in your own `devDependencies`.

## Quick example

`@nestjs/swagger` doesn't know nominal types. It describes `id: UserId` as `{ "type": "object", "properties": {} }`. Pass the document through `applyNominalTypes()` before serving it:

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { applyNominalTypes } from '@horizon-republic/nominal-types/adapters/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder().setTitle('Shop').build();
  const document = applyNominalTypes(SwaggerModule.createDocument(app, config));

  SwaggerModule.setup('docs', app, document);
  await app.listen(3000);
}

void bootstrap();
```

Every empty schema named after a nominal type now holds that type's schema. For `class UserId extends Uuid.subtype('shop.UserId') {}`:

```json
{
  "title": "shop.UserId",
  "type": "string",
  "pattern": "^(?:[\\dA-Fa-f]{8}-…)$",
  "format": "uuid",
  "minLength": 36,
  "maxLength": 36,
  "description": "a UUID",
  "example": "0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"
}
```

## Document route parameters

A parameter declared with a nominal type is documented once the document is filled:

```ts
// users.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { n, Uuid } from '@horizon-republic/nominal-types';
import { UserId } from './user-id';

@Controller('users')
export class UsersController {
  @Get(':id')
  find(@Param('id') id: UserId): string {
    return id.value;
  }

  @Get()
  search(@Query('ids', { schema: n.of(Uuid).array({ max: 100 }) }) ids: readonly Uuid[]): number {
    return ids.length;
  }
}
```

On Nest 12, an `n.of()` schema in the `schema` option is documented by `@nestjs/swagger` itself, with `items` and `maxItems`.

## Document query values

`@nestjs/swagger` reads a query value from the parameter's declared type. That type loses two things:

- A list behind a pipe, such as `new NominalPipe(n.of(Uuid).array({ max: 100 }))`, is shown as a list of strings, without the item's format and pattern or `maxItems`.
- `page?: PositiveInteger` is shown as required.

Describe such a value with `@ApiNominalQuery()` on the route. It takes the parameter's name and a type or an `n.of()` schema:

```ts
// users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';
import { ApiNominalQuery } from '@horizon-republic/nominal-types/adapters/swagger';

@Controller('users')
export class UsersController {
  @Get()
  @ApiNominalQuery('ids', n.of(Uuid).array({ max: 100 }))
  @ApiNominalQuery('page', PositiveInteger, { required: false })
  list(
    @Query('ids', new NominalPipe(n.of(Uuid).array({ max: 100 }))) ids: readonly Uuid[],
    @Query('page') page?: PositiveInteger,
  ) {
    return { count: ids.length, page: page?.value ?? 1 };
  }
}
```

The two parameters in the document:

```json
[
  { "name": "ids", "in": "query", "required": true,
    "schema": { "type": "array", "maxItems": 100, "items": { "type": "string", "format": "uuid", … } } },
  { "name": "page", "in": "query", "required": false,
    "schema": { "title": "nominal.PositiveInteger", "allOf": [ … ] } }
]
```

A value is required unless its schema is `.optional()`, so `n.of(PositiveInteger).optional()` also gives `"required": false`. The third argument takes `required` and `description`, and they win.

## Document DTO properties

Use `@ApiNominalProperty()` for lists and optional values. It writes the whole schema into the property:

```ts
// create-order.dto.ts
import { AnyString, Email, n, Uuid } from '@horizon-republic/nominal-types';
import { ApiNominalProperty } from '@horizon-republic/nominal-types/adapters/swagger';

export class CreateOrderDto {
  @ApiNominalProperty(Email)
  customer!: Email;

  @ApiNominalProperty(n.of(Uuid).array({ min: 1, max: 50 }))
  coupons!: readonly Uuid[];

  @ApiNominalProperty(n.of(AnyString).optional(), { description: 'Shown on the packing slip' })
  note?: AnyString;
}
```

A property is required unless its schema is `.optional()`. The second argument takes `@ApiProperty()` options, and they win over the generated ones.

For a single value, plain `@ApiProperty()` works too. The property points to the type's schema, which `applyNominalTypes()` fills. The Swagger CLI plugin adds such `@ApiProperty()` lines for you:

```ts
// contact.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Email } from '@horizon-republic/nominal-types';

export class ContactDto {
  @ApiProperty()
  email!: Email;
}
```

Keep `applyNominalTypes()` in `main.ts` either way. A number type such as `PositiveInteger` points to its shared schema even with `@ApiNominalProperty()`.

If the DTO is also checked with [class-validator](../validators/class-validator.md), put both decorators on the property:

```ts
// create-order.dto.ts
import { Email } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';
import { ApiNominalProperty } from '@horizon-republic/nominal-types/adapters/swagger';

export class CreateOrderDto {
  @NominalField(Email)
  @ApiNominalProperty(Email)
  customer!: Email;
}
```

## Document a request body

`@nestjs/swagger` doesn't see a body checked by `@Body(new NominalPipe(CreateOrder))`, so the route gets no request body. Add `@ApiNominalBody()` with the same schema:

```ts
// orders.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';
import { ApiNominalBody } from '@horizon-republic/nominal-types/adapters/swagger';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });
type CreateOrderBody = ValueOf<typeof CreateOrder>;

@Controller('orders')
export class OrdersController {
  @Post()
  @ApiNominalBody(CreateOrder, { name: 'CreateOrder' })
  create(@Body(new NominalPipe(CreateOrder)) order: CreateOrderBody) {
    return { domain: order.customer.domain };
  }
}
```

With `name`, the schema of an object is listed once under `components.schemas` with that name, and the body refers to it:

```json
{ "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/CreateOrder" } } } }
```

Without `name`, the schema is written into the request body itself. A schema that is not an object, such as `n.of(Uuid).array()`, is always written there. The body is required unless the schema is `.optional()`. The second argument also takes `required` and `description`.

## Name a class differently from its type

The schema is found by the class name. A dotted type name is found by its last part, so `class UserId extends Uuid.subtype('shop.UserId') {}` needs nothing more.

When the class name and the type name differ, tell Swagger the type's name with `@ApiSchema()`:

```ts
// mailbox.ts
import { ApiSchema } from '@nestjs/swagger';
import { AnyString } from '@horizon-republic/nominal-types';

@ApiSchema({ name: 'shop.MailboxAddress' })
export class Mailbox extends AnyString.subtype('shop.MailboxAddress', /^[a-z]+@example\.com$/u) {}
```

## Errors

A schema that was not filled stays `{ "type": "object", "properties": {} }`. Check the class name against the type name.

`@ApiNominalProperty()`, `@ApiNominalBody()` and `@ApiNominalQuery()` take a nominal type or an `n.of()` or `n.object()` schema. Anything else throws a `TypeError` with the decorator's name, such as `TypeError: ApiNominalBody() takes a nominal type or an n.of() schema`.

## Limits

- Two types whose names end in the same part, such as your `billing.Email` and the built-in `nominal.Email`, can't both be found by the last part. Name yours in full with `@ApiSchema({ name: 'billing.Email' })`, as in [Name a class differently from its type](#name-a-class-differently-from-its-type). The built-in one is then found as `Email`.
- The schema is found by the class name. A server build that shortens names, such as one with esbuild's or tsup's `minify`, needs `keepNames: true`. With terser, set `keep_classnames: true`.
- Give the type of a schema's value its own name, such as `type CreateOrderBody = ValueOf<typeof CreateOrder>`. Under Bun and SWC, a type named like the schema makes `@nestjs/swagger` write a broken `$ref`. See [Limits in the NestJS guide](../frameworks/nestjs.md#limits).
- For other OpenAPI tools, get the schema yourself: see [How to get a JSON Schema for a type](json-schema.md).

## See also

- [Swagger adapter reference](../../reference/adapters/swagger.md): every export, its signature and errors.
- [How to get a JSON Schema for a type](json-schema.md)
- [How to use nominal types with NestJS](../frameworks/nestjs.md)
- [How to use nominal types with class-validator](../validators/class-validator.md)

[← Guides](../README.md)
