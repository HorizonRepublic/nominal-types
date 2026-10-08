# swagger

Entry point: `@horizon-republic/nominal-types/adapters/swagger`. Needs `@nestjs/swagger` 11 or 12. It doesn't need class-validator or class-transformer.

| Export                 | Kind      | Use it for                                                  |
| ---------------------- | --------- | ----------------------------------------------------------- |
| `applyNominalTypes()`  | function  | filling the schemas `@nestjs/swagger` leaves empty          |
| `ApiNominalProperty()` | decorator | a DTO property documented with its type's whole schema      |
| `OpenApiDocument`      | type      | the part of an OpenAPI document `applyNominalTypes()` reads |

## applyNominalTypes()

```ts
function applyNominalTypes<Document extends OpenApiDocument>(document: Document): Document;
```

| Parameter  | Type             | Description                                    |
| ---------- | ---------------- | ---------------------------------------------- |
| `document` | OpenAPI document | the result of `SwaggerModule.createDocument()` |

`@nestjs/swagger` describes a nominal type, such as the `Uuid` in `@Param('id') id: Uuid`, as an empty object named after the class. `applyNominalTypes()` replaces each such schema with the type's OpenAPI 3.0 schema: pattern, format, length limits, example. Every `$ref` to it then shows them. A rule from a library without OpenAPI 3.0 output, such as ArkType, is described as `draft-07`.

Returns a new document. The document passed in is not changed. Schemas with properties are left alone.

How a schema finds its type:

| Schema name                         | Found type                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| the full type name, `billing.Email` | that type                                                                                        |
| the last part, `InvoiceNumber`      | the one type whose name ends in `.InvoiceNumber`, leaving out types that have a full-name schema |
| a last part two types share         | none; the schema stays empty                                                                     |

Name the class like the type or like its last part. Otherwise, give the type's name with `@ApiSchema({ name: 'billing.Email' })` from `@nestjs/swagger`. A type with such a full-name schema leaves its last part to the others: `nominal.Email` is still found as `Email`.

## ApiNominalProperty()

```ts
function ApiNominalProperty(target: NominalTarget, options?: ApiPropertyOptions): PropertyDecorator;
```

| Parameter | Type                            | Default | Description                                               |
| --------- | ------------------------------- | ------- | --------------------------------------------------------- |
| `target`  | nominal type or `n.of()` schema | —       | what the property holds                                   |
| `options` | `@ApiProperty()` options        | `{}`    | they win over the generated schema, such as `description` |

Writes the whole OpenAPI 3.0 schema into the property. A list gets `items`, `minItems` and `maxItems`. The property is required unless the schema accepts a missing value, as `n.of(Email).optional()` does.

Throws `TypeError: ApiNominalProperty() takes a nominal type or an n.of() schema` when `target` is neither.

To validate the same property, put `@NominalField()` from the [class-validator adapter](class-validator.md) next to it.

## Example

Fill the document:

```ts
// main.ts
import 'reflect-metadata';
import { Controller, Get, Module, Param } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { applyNominalTypes } from '@horizon-republic/nominal-types/adapters/swagger';
import { Uuid } from '@horizon-republic/nominal-types';

@Controller('orders')
class OrdersController {
  @Get(':id')
  find(@Param('id') id: Uuid) {
    return id.value;
  }
}

@Module({ controllers: [OrdersController] })
class AppModule {}

const app = await NestFactory.create(AppModule);
const raw = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Shop').build());
const document = applyNominalTypes(raw);

raw.components?.schemas?.['Uuid']; // { type: 'object', properties: {} }
document.components?.schemas?.['Uuid'];
// { title: 'nominal.Uuid', type: 'string', pattern: '…', format: 'uuid', minLength: 36, maxLength: 36,
//   description: 'a UUID', example: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f' }
SwaggerModule.setup('docs', app, document);
```

Document DTO properties:

```ts
import { ApiNominalProperty } from '@horizon-republic/nominal-types/adapters/swagger';
import { Email, n, Uuid } from '@horizon-republic/nominal-types';

export class CreateOrderDto {
  @ApiNominalProperty(Email)
  customer!: Email; // { type: 'string', format: 'email', maxLength: 254, … }, required

  @ApiNominalProperty(n.of(Uuid).array({ min: 1, max: 50 }))
  items!: readonly Uuid[]; // { type: 'array', items: { format: 'uuid', … }, minItems: 1, maxItems: 50 }

  @ApiNominalProperty(n.of(Email).optional(), { description: 'where copies go' })
  backup?: Email; // not required, description: 'where copies go'
}

ApiNominalProperty(String as never);
// throws TypeError: ApiNominalProperty() takes a nominal type or an n.of() schema
```

## See also

- [How to document nominal types in Swagger](../../guides/api-docs/swagger.md)
- [JSON Schema](../json-schema.md)
- [nest](nest.md)

[← Adapters](README.md) · [← Reference](../README.md)
