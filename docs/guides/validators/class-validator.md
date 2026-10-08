# How to use nominal types with class-validator

Declare [DTO](../../reference/glossary.md) properties as nominal types, so a valid value becomes an instance, such as an `Email`, and a bad one fails with the type's message.

New project? Check bodies with [n.object()](../core/check-an-object.md). Use this guide if you already use class-validator.

## Before you start

- Install both libraries: `npm install class-validator class-transformer`.
- The decorator comes from the [adapter](../../reference/glossary.md) `@horizon-republic/nominal-types/adapters/class-validator`. It is a separate [entry point](../../reference/glossary.md): you need the two libraries only if you import it.
- It works with class-validator 0.14 and 0.15, and class-transformer 0.5.1 or later.
- Turn on decorators in `tsconfig.json`: `"experimentalDecorators": true` and `"emitDecoratorMetadata": true`. A NestJS project has both already.

## Quick example

Put `@NominalField()` on each property, with the type it holds:

```ts
// create-order.dto.ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AnyString, Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export class CreateOrderDto {
  @NominalField(Email) customer!: Email;
  @NominalField(Sku) sku!: Sku;
  @NominalField(PositiveInteger) quantity!: PositiveInteger;
  @NominalField(n.of(AnyString).optional()) note?: AnyString;
}

const order = plainToInstance(CreateOrderDto, { customer: 'jane@example.com', sku: 'TEA-0042', quantity: 2 });
validateSync(order).length; // 0
order.customer instanceof Email; // true

const bad = plainToInstance(CreateOrderDto, { customer: 'jane', sku: 'TEA-0042', quantity: 0 });
validateSync(bad).map((error) => error.constraints);
// [{ nominalField: 'customer: must be an email address (was a string of 4 characters)' },
//  { nominalField: 'quantity: must be a positive integer (was 0)' }]
```

One decorator does three jobs:

- it turns a valid value into an instance;
- it fails validation for a bad value, with the type's message;
- it marks the property as known, so `whitelist` keeps it.

A property is required unless its schema is `.optional()`. You don't need `@IsOptional()`.

## Check a request body in NestJS

Register `ValidationPipe` with `transform: true` in `main.ts`:

```ts
// main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(3000);
}

void bootstrap();
```

Then use the DTO in a controller as usual:

```ts
// orders.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { CreateOrderDto } from './create-order.dto';

@Controller('orders')
export class OrdersController {
  @Post()
  create(@Body() order: CreateOrderDto): string {
    return order.customer.domain; // order.customer is an Email
  }
}
```

> Without `transform: true`, values are still checked, but the handler gets plain strings, not instances.

## Lists, optional and nested fields

For a list or an optional value, pass an [`n.of()`](../core/lists-and-optional-values.md) schema. For a nested DTO, use class-validator's `@ValidateNested()` and class-transformer's `@Type()` as usual:

```ts
// create-shipment.dto.ts
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Email, n, Uuid } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

export class AddressDto {
  @NominalField(Email)
  email!: Email;
}

export class CreateShipmentDto {
  @NominalField(n.of(Uuid).array({ min: 1, max: 50 }))
  orders!: readonly Uuid[];

  @NominalField(n.of(Email).optional())
  backup?: Email;

  @ValidateNested()
  @Type(() => AddressDto)
  billing!: AddressDto;
}
```

A list item adds its index to the message, and a nested DTO adds the parent's name: `orders.0: must be a UUID (was "x")`, `billing.email: must be an email address (was a string of 1 character)`.

## Read numbers from a query string

Query values are always strings. For number and boolean types, read the text first with `fromString()`:

```ts
// search-orders.dto.ts
import { n, PositiveInteger } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

export class SearchOrdersDto {
  @NominalField(n.of(PositiveInteger).fromString())
  page!: PositiveInteger;
}
```

With `@Query() query: SearchOrdersDto`, `?page=3` arrives as `PositiveInteger(3)`. `?page=0` fails with `page: must be a positive integer (was 0)`. [How to read numbers and booleans from strings](../core/read-text-values.md) has more.

## Send DTOs in responses

A decorated property goes out as its value, with Nest's plain `JSON.stringify` and with `ClassSerializerInterceptor` alike.

To write something other than the value, pass `serialize`. It gets the instance and returns what goes out:

```ts
// contact.dto.ts
import { Email } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

export class ContactDto {
  @NominalField(Email)
  email!: Email; // 'jane@example.com' goes out as 'jane@example.com'

  // canonical(): lowercased and without the +tag
  @NominalField(Email, { serialize: (email) => email.canonical().value })
  login!: Email; // 'Jane.Doe+news@Example.com' goes out as 'jane.doe@example.com'
}
```

For an `n.of(...).array()` property, `serialize` gets the whole list. A missing value (`undefined` or `null`) is written as it is, without calling `serialize`. [Email](../../reference/types/string.md) lists `canonical()` and the other methods.

## Errors

A bad body gets status 400. Each message starts with the property name:

```json
{
  "message": [
    "customer: must be an email address (was a string of 4 characters)",
    "sku: must be matched by ^[A-Z]{3}-\\d{4}$ (was \"tea\")",
    "quantity: must be a positive integer (was 0)"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

A missing property reads `customer: must be a string (was undefined)`.

To change the message, pass class-validator's own options as the second argument, such as `message` or `groups`:

```ts
// contact.dto.ts
import { Email } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

export class ContactDto {
  @NominalField(Email, { message: 'Enter a real email address' })
  email!: Email;
}
```

## Limits

- `serialize` runs only through `ClassSerializerInterceptor` or `instanceToPlain`. Plain `JSON.stringify` always writes the value.
- With `ClassSerializerInterceptor`, an instance in a property without `@NominalField()` comes out as `{ "value": "jane@example.com" }`. Decorate every such property.
- `@NominalField()` takes a nominal type or an `n.of()` schema. Anything else throws `TypeError: NominalField() takes a nominal type or an n.of() schema`.

## See also

- [class-validator adapter reference](../../reference/adapters/class-validator.md): every export, its signature and options.
- [How to use nominal types with NestJS](../frameworks/nestjs.md)
- [How to document nominal types in Swagger](../api-docs/swagger.md)
- [How to accept lists, missing values and null](../core/lists-and-optional-values.md)

[← Guides](../README.md)
