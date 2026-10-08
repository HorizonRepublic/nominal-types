# swagger

Entry point: `@horizon-republic/nominal-types/adapters/swagger`. Needs `@nestjs/swagger` 11 or 12. It doesn't need class-validator or class-transformer.

| Export                   | Kind      | Use it for                                                  |
| ------------------------ | --------- | ----------------------------------------------------------- |
| `applyNominalTypes()`    | function  | filling the schemas `@nestjs/swagger` leaves empty          |
| `ApiNominalProperty()`   | decorator | a DTO property documented with its type's whole schema      |
| `ApiNominalBody()`       | decorator | the request body of a route checked by `NominalPipe`        |
| `ApiNominalQuery()`      | decorator | a query value documented with its type's whole schema       |
| `OpenApiDocument`        | type      | the part of an OpenAPI document `applyNominalTypes()` reads |
| `ApiNominalBodyOptions`  | type      | the options of `ApiNominalBody()`                           |
| `ApiNominalQueryOptions` | type      | the options of `ApiNominalQuery()`                          |

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

Schema names come from class names. A minified server build needs class names kept: `keepNames: true` in esbuild and tsup, `keep_classnames: true` in terser.

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

## ApiNominalBody()

```ts
function ApiNominalBody(target: NominalTarget, options?: ApiNominalBodyOptions): MethodDecorator;
```

| Parameter | Type                                          | Default | Description           |
| --------- | --------------------------------------------- | ------- | --------------------- |
| `target`  | nominal type, `n.of()` or `n.object()` schema | —       | what the body holds   |
| `options` | `ApiNominalBodyOptions`                       | `{}`    | see the options below |

| Option        | Type      | Default                                                    | Description                                                                  |
| ------------- | --------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `name`        | `string`  | none                                                       | lists an object schema under `components.schemas` and refers to it by `$ref` |
| `required`    | `boolean` | `true`, or `false` when the schema accepts a missing value | whether the body is required                                                 |
| `description` | `string`  | none                                                       | the body's description                                                       |

Goes on the route. Writes the target's OpenAPI 3.0 schema as the request body, which `@nestjs/swagger` can't read through `@Body(new NominalPipe(target))`. Without `name`, or for a schema that is not an object, the schema is written into the body. It replaces the body `@nestjs/swagger` reads from the parameter.

Throws `TypeError: ApiNominalBody() takes a nominal type or an n.of() schema` when `target` is neither.

## ApiNominalQuery()

```ts
function ApiNominalQuery(name: string, target: NominalTarget, options?: ApiNominalQueryOptions): MethodDecorator;
```

| Parameter | Type                            | Default | Description                            |
| --------- | ------------------------------- | ------- | -------------------------------------- |
| `name`    | `string`                        | —       | the query parameter's name             |
| `target`  | nominal type or `n.of()` schema | —       | what the value holds                   |
| `options` | `ApiNominalQueryOptions`        | `{}`    | `required` and `description`; they win |

Goes on the route. Writes the target's OpenAPI 3.0 schema into the query parameter, in place of what `@nestjs/swagger` reads from the declared type. A list keeps `items`, `minItems` and `maxItems`. The value is required unless the schema accepts a missing value, as `n.of(PositiveInteger).optional()` does.

| Parameter                                                        | Without it                                     | With `@ApiNominalQuery()`                                        |
| ---------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `@Query('ids', new NominalPipe(n.of(Uuid).array({ max: 100 })))` | `{ type: 'array', items: { type: 'string' } }` | `{ type: 'array', maxItems: 100, items: { format: 'uuid', … } }` |
| `@Query('page') page?: PositiveInteger`                          | required                                       | not required, with `{ required: false }`                         |

Throws `TypeError: ApiNominalQuery() takes a nominal type or an n.of() schema` when `target` is neither.

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

Document a body and query values:

```ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Email, n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';
import { ApiNominalBody, ApiNominalQuery } from '@horizon-republic/nominal-types/adapters/swagger';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });
type CreateOrderBody = ValueOf<typeof CreateOrder>;

@Controller('orders')
export class OrdersController {
  @Post()
  @ApiNominalBody(CreateOrder, { name: 'CreateOrder' }) // { $ref: '#/components/schemas/CreateOrder' }
  create(@Body(new NominalPipe(CreateOrder)) order: CreateOrderBody) {
    return order.customer.domain;
  }

  @Get()
  @ApiNominalQuery('ids', n.of(Uuid).array({ max: 100 })) // { type: 'array', maxItems: 100, items: { format: 'uuid', … } }
  @ApiNominalQuery('page', PositiveInteger, { required: false }) // required: false
  list(
    @Query('ids', new NominalPipe(n.of(Uuid).array({ max: 100 }))) ids: readonly Uuid[],
    @Query('page') page?: PositiveInteger,
  ) {
    return { count: ids.length, page: page?.value ?? 1 };
  }
}
```

## See also

- [How to document nominal types in Swagger](../../guides/api-docs/swagger.md)
- [JSON Schema](../json-schema.md)
- [nest](nest.md)

[← Adapters](README.md) · [← Reference](../README.md)
