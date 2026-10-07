# How to use nominal types in class-validator DTOs

> Recommended for projects that already use class-validator. For new code, an ArkType schema is simpler and several times faster: see [Choosing how to check input](../explanation/choosing-an-approach.md).

This guide shows how to declare DTO properties as nominal types when your project validates DTO classes with class-validator and class-transformer, as NestJS's `ValidationPipe` does.

The decorator comes from a separate entry point, `@horizon-republic/nominal-types/adapters/class-validator`. You only need `class-validator` and `class-transformer` if you import it.

> This adapter is for projects that already use class-validator. If you're starting a new project, a schema library such as [ArkType](other-validators.md) may be the simpler choice: it takes nominal types directly and needs no class-transformer, which hasn't had a new release in several years.

## Declaring properties

Put `@NominalField()` on each property, with a type or a [`schemaOf()`](arrays-and-optional.md) schema:

```ts
import { Email, schemaOf, Uuid } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

export class CreateOrderDto {
  @NominalField(Email)
  contact!: Email;

  @NominalField(schemaOf(Uuid).array({ min: 1, max: 50 }))
  items!: readonly Uuid[];

  @NominalField(schemaOf(Email).optional())
  backup?: Email;
}
```

One decorator does three jobs:

- turns a valid value into an instance, such as an `Email`;
- fails validation for a bad value, with the type's message;
- marks the property as known, so `whitelist` keeps it.

A property is required unless its schema is `.optional()`. You don't need `@IsOptional()`.

## Using it in NestJS

Register `ValidationPipe` with `transform: true`:

```ts
import { ValidationPipe } from '@nestjs/common';

app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
```

Then use the DTO as usual:

```ts
@Post()
create(@Body() order: CreateOrderDto) {
  order.contact.domain; // order.contact is an Email
}
```

> **Warning:** without `transform: true`, values are still validated, but the handler gets plain strings, not instances.

A bad body fails with status 400. Each message names the property, and a list item adds its index:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["contact: must be an email address (was \"nope\")", "items.0: must be a UUID (was \"x\")"]
}
```

## Nested DTOs

Use `@ValidateNested()` and `@Type()` as usual. Messages get the parent's name in front, such as `billing.email: must be an email address (was "y")`:

```ts
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class AddressDto {
  @NominalField(Email)
  email!: Email;
}

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => AddressDto)
  billing!: AddressDto;
}
```

## Query DTOs

Query values are strings. For number and boolean types, read them with `fromString()`, as described in [How to read values from strings](reading-strings.md):

```ts
export class SearchDto {
  @NominalField(schemaOf(PositiveInteger).fromString())
  page!: PositiveInteger;
}

@Get()
search(@Query() query: SearchDto) {
  query.page.value; // '?page=3' arrives as 3
}
```

## Sending DTOs in responses

Nest writes a response with `JSON.stringify`, which turns every nominal instance into its value. That needs nothing extra.

`ClassSerializerInterceptor` works differently: it turns the DTO into a plain object with class-transformer first, and class-transformer doesn't use `toJSON()`. `@NominalField()` handles that, so a decorated property comes out as its value:

```ts
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

@Get()
find(): AccountDto {
  return account; // { "contact": "jane@example.com", "teams": ["0190f1c2-…"] }
}
```

> **Warning:** with `ClassSerializerInterceptor`, a nominal instance in a property without `@NominalField()` comes out as `{ "value": "jane@example.com" }`. Decorate every such property.

## Choosing what a property is written as

To write something other than the value, pass `serialize`. It gets the instance, or the list for a `schemaOf(...).array()` property, and returns what goes out:

```ts
export class ContactDto {
  @NominalField(Email, { serialize: (email) => email.canonical().value })
  email!: Email; // 'Jane.Doe+news@Example.com' goes out as 'jane.doe@example.com'

  @NominalField(schemaOf(Uuid).array(), { serialize: (ids) => ids.map((id) => id.canonical().value) })
  teams!: readonly Uuid[];
}
```

What to know:

- `serialize` runs only through `ClassSerializerInterceptor` or `instanceToPlain`. Without them, Nest uses `JSON.stringify`, which always writes the value.
- A missing value (`undefined` or `null`) is written as it is, without calling `serialize`.

## Changing the message

The second argument takes class-validator's own options, such as `message` or `groups`:

```ts
@NominalField(Email, { message: 'Please enter a real email address' })
email!: Email;
```

[← Guides](README.md)
