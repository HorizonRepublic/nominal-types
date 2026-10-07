# How to use a type inside another validator

This guide shows how to put nominal types inside a schema from another library. The library then gives you back instances, such as an `Email`, instead of strings.

## Libraries that read Standard Schema

Some libraries accept any [Standard Schema](https://standardschema.dev). Every nominal type is a Standard Schema, so pass the class itself.

For example, NestJS 12 with its own `StandardSchemaValidationPipe`:

```ts
import { Controller, Get, Query, StandardSchemaValidationPipe } from '@nestjs/common';
import { Email } from '@horizon-republic/nominal-types';

app.useGlobalPipes(new StandardSchemaValidationPipe());

@Controller('users')
export class UsersController {
  @Get()
  search(@Query('email', { schema: Email }) email: Email) {}
}
```

For NestJS 11 and 12 there is also `NominalPipe`, which needs no `schema` option. See [How to validate NestJS route parameters](nestjs.md).

## ArkType and other schema builders

Libraries such as ArkType treat a class as something of their own. Pass `Type.standardSchema()` instead, which returns a plain schema object:

```ts
import { type } from 'arktype';
import { Email, Uuid } from '@horizon-republic/nominal-types';

const invitation = type({ email: Email.standardSchema(), team: Uuid.standardSchema() });

const { email } = invitation.assert({
  email: 'jane@example.com',
  team: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
});

email instanceof Email; // true
```

## Zod and Valibot

Zod and Valibot only accept their own schemas inside an object schema. A nominal type can't be placed there directly: Zod reports `expected a Zod schema`.

You can still use a Zod or Valibot schema as the rule of a nominal type, as shown in [How to declare a type](declaring-types.md#declaring-with-a-schema-from-another-library).

[← Guides](README.md)
