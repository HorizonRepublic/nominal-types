# How to document nominal types in Swagger

This guide shows how to make `@nestjs/swagger` describe nominal types fully: pattern, format, length limits and an example, instead of an empty object.

The helpers come from a separate entry point, `@horizon-republic/nominal-types/adapters/swagger`. You only need `@nestjs/swagger` if you import it. It works with `@nestjs/swagger` 11 and 12, and doesn't need class-transformer or class-validator.

## Filling the document

`@nestjs/swagger` doesn't know nominal types. It describes `id: Uuid` as an empty object called `Uuid`. Pass the document through `applyNominalTypes()` before serving it:

```ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { applyNominalTypes } from '@horizon-republic/nominal-types/adapters/swagger';

const config = new DocumentBuilder().setTitle('Shop').build();
const document = applyNominalTypes(SwaggerModule.createDocument(app, config));

SwaggerModule.setup('docs', app, document);
```

Every empty schema named after a nominal type is replaced with that type's schema. For `Uuid`:

```json
{
  "title": "Uuid",
  "type": "string",
  "pattern": "^(?:[\\dA-Fa-f]{8}-…)$",
  "format": "uuid",
  "minLength": 36,
  "maxLength": 36,
  "example": "0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f",
  "description": "a UUID"
}
```

Your own types get the same treatment, under their own names: `UserId` for `Uuid.subtype('UserId')`.

## Route parameters

A parameter declared with a nominal type is documented once the document is filled:

```ts
@Get(':id')
find(@Param('id') id: UserId) {}
```

On Nest 12, a `schemaOf()` schema in the decorator is documented by `@nestjs/swagger` itself, with lists and their limits:

```ts
@Get()
search(@Query('ids', { schema: schemaOf(Uuid).array({ max: 100 }) }) ids: readonly Uuid[]) {}
```

## DTO properties

Pick one of two ways.

With `@ApiProperty()`, as `@nestjs/swagger` usually works. The property points to the type's schema, which `applyNominalTypes()` fills. The Swagger CLI plugin adds such `@ApiProperty()` declarations for you:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class ContactDto {
  @ApiProperty()
  email!: Email;
}
```

With `@ApiNominalProperty()`, which writes the whole schema into the property and handles lists and optional values:

```ts
import { ApiNominalProperty } from '@horizon-republic/nominal-types/adapters/swagger';

export class CreateOrderDto {
  @ApiNominalProperty(Email)
  contact!: Email;

  @ApiNominalProperty(schemaOf(Uuid).array({ min: 1, max: 50 }))
  items!: readonly Uuid[];

  @ApiNominalProperty(schemaOf(Email).optional())
  backup?: Email;
}
```

A property is required unless its schema is `.optional()`. The second argument takes `@ApiProperty()` options, such as `description`, and they win over the generated ones.

If the DTO is also validated with [class-validator](class-validator.md), put both decorators on the property:

```ts
@NominalField(Email)
@ApiNominalProperty(Email)
contact!: Email;
```

## Other OpenAPI tools

Any tool that reads [Standard JSON Schema](https://standardschema.dev) can take a `schemaOf()` schema directly. To get the schema yourself, see [How to generate JSON Schema](json-schema.md).

[← Guides](README.md)
