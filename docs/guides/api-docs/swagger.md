# How to document nominal types in Swagger

Make `@nestjs/swagger` describe each nominal type with its pattern, format, length limits and example, instead of an empty object.

## Before you start

- Install Swagger for Nest: `npm install @nestjs/swagger`.
- The helpers come from the [adapter](../../reference/glossary.md) `@horizon-republic/nominal-types/adapters/swagger`. It is a separate [entry point](../../reference/glossary.md): you need `@nestjs/swagger` only if you import it.
- It works with `@nestjs/swagger` 11 and 12. It needs neither class-validator nor class-transformer.

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
import { schemaOf, Uuid } from '@horizon-republic/nominal-types';
import { UserId } from './user-id';

@Controller('users')
export class UsersController {
  @Get(':id')
  find(@Param('id') id: UserId): string {
    return id.value;
  }

  @Get()
  search(@Query('ids', { schema: schemaOf(Uuid).array({ max: 100 }) }) ids: readonly Uuid[]): number {
    return ids.length;
  }
}
```

On Nest 12, a `schemaOf()` schema in the `schema` option is documented by `@nestjs/swagger` itself, with `items` and `maxItems`.

## Document DTO properties

Use `@ApiNominalProperty()` for lists and optional values. It writes the whole schema into the property:

```ts
// create-order.dto.ts
import { AnyString, Email, schemaOf, Uuid } from '@horizon-republic/nominal-types';
import { ApiNominalProperty } from '@horizon-republic/nominal-types/adapters/swagger';

export class CreateOrderDto {
  @ApiNominalProperty(Email)
  customer!: Email;

  @ApiNominalProperty(schemaOf(Uuid).array({ min: 1, max: 50 }))
  coupons!: readonly Uuid[];

  @ApiNominalProperty(schemaOf(AnyString).optional(), { description: 'Shown on the packing slip' })
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

`@ApiNominalProperty()` takes a nominal type or a `schemaOf()` schema. Anything else throws `TypeError: ApiNominalProperty() takes a nominal type or a schemaOf() schema`.

## Limits

- Two types whose names end in the same part, such as your `billing.Email` and the built-in `nominal.Email`, can't both be found by the last part. Name yours in full with `@ApiSchema({ name: 'billing.Email' })`, as in [Name a class differently from its type](#name-a-class-differently-from-its-type). The built-in one is then found as `Email`.
- For other OpenAPI tools, get the schema yourself: see [How to get a JSON Schema for a type](json-schema.md).

## See also

- [Swagger adapter reference](../../reference/adapters/swagger.md): every export, its signature and errors.
- [How to get a JSON Schema for a type](json-schema.md)
- [How to use nominal types with NestJS](../frameworks/nestjs.md)
- [How to use nominal types with class-validator](../validators/class-validator.md)

[← Guides](../README.md)
