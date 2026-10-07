# How to use a type inside another validator

> For ArkType, Zod and Valibot, use their adapters: [ArkType](arktype.md), [Zod](zod.md), [Valibot](valibot.md). `schemaOf()` fits libraries without an adapter: see [Choosing how to check input](../explanation/choosing-an-approach.md).

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

For ArkType, use the adapter: see [How to use nominal types in ArkType schemas](arktype.md). It keeps ArkType on its fast path.

Without an adapter, libraries such as ArkType treat a class as something of their own. Pass `schemaOf(Type)` instead, which returns a plain schema object:

```ts
import { type } from 'arktype';
import { Email, schemaOf, Uuid } from '@horizon-republic/nominal-types';

const invitation = type({ email: schemaOf(Email), team: schemaOf(Uuid) });

const { email } = invitation.assert({
  email: 'jane@example.com',
  team: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
});

email instanceof Email; // true
```

[← Guides](README.md)
