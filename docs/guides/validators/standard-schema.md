# How to use a type in any Standard Schema library

Every nominal type is a [Standard Schema](../../reference/glossary.md): a common interface that many libraries read. Pass the type to such a library, and it hands you instances, such as an `Email`, instead of strings.

New project? Check bodies with [objectOf()](../core/check-an-object.md). Use this guide if you already use a library that reads Standard Schema.

For ArkType, Zod and Valibot, use their adapters instead: [ArkType](arktype.md), [Zod](zod.md), [Valibot](valibot.md).

## Before you start

- Nothing extra to install. Every type, every `schemaOf()` schema and every `objectOf()` schema is a Standard Schema.
- The library must read Standard Schema version 1.

## Quick example

Every Standard Schema has a property named [`~standard`](../../reference/glossary.md). A library calls its `validate()` on the schema you give it, like this:

```ts
// check.ts
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { Email, schemaOf, Uuid } from '@horizon-republic/nominal-types';

// What a library does with any schema you hand it:
const check = (schema: StandardSchemaV1, value: unknown) => schema['~standard'].validate(value);

check(Email, 'jane@example.com'); // { value: Email { value: 'jane@example.com' } }
check(Email, 'nope'); // { issues: [{ message: 'must be an email address (was a string of 4 characters)' }] }
check(schemaOf(Uuid).array(), ['nope']); // { issues: [{ message: 'must be a UUID (was "nope")', path: [0] }] }
```

You never write `check()` yourself. You pass `Email` where the library asks for a schema.

## Pass a type where a library asks for a schema

NestJS 12 reads Standard Schema through its `StandardSchemaValidationPipe`. Register the pipe in `main.ts`:

```ts
// main.ts
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  await app.listen(3000);
}

void bootstrap();
```

Then pass the type, or a `schemaOf()` schema for a list, as the `schema` option:

```ts
// users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { Email, schemaOf, Uuid } from '@horizon-republic/nominal-types';

@Controller('users')
export class UsersController {
  @Get()
  search(@Query('email', { schema: Email }) email: Email): string {
    return email.domain; // email is an Email
  }

  @Get('many')
  many(@Query('ids', { schema: schemaOf(Uuid).array({ max: 2 }) }) ids: readonly Uuid[]): number {
    return ids.length;
  }
}
```

`GET /users?email=nope` gets status 400: `{ "message": ["must be an email address (was a string of 4 characters)"], "error": "Bad Request", "statusCode": 400 }`.

For NestJS 11 and 12 the package also has its own `NominalPipe`, which needs no `schema` option. See [How to use nominal types with NestJS](../frameworks/nestjs.md).

## Pass schemaOf() when a library treats a class as its own

Some libraries read a class in a schema as something of their own. ArkType fails with `TypeError: Class constructor Email cannot be invoked without 'new'`. Pass `schemaOf(Type)` instead, a plain schema object:

```ts
import { type } from 'arktype';
import { Email, schemaOf, Uuid } from '@horizon-republic/nominal-types';

const Invitation = type({ email: schemaOf(Email), team: schemaOf(Uuid) });

const invitation = Invitation.assert({
  email: 'jane@example.com',
  team: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
});

invitation.email instanceof Email; // true
```

For ArkType itself, the [ArkType adapter](arktype.md) is much faster. Use `schemaOf()` this way for libraries without an adapter.

## Errors

A rejected value gives Standard Schema issues. Each has a `message` and, inside a list or an object, a `path`:

```ts
// { issues: [{ message: 'must be a UUID (was "nope")', path: [0] }] }
```

The library decides what to do with them. NestJS answers 400 with the messages. ArkType throws `TraversalError: must be an email address (was a string of 4 characters)` from `assert()`.

## Limits

- NestJS's own pipe doesn't turn a single query value into a list. `GET /users/many?ids=<one id>` fails with `must be an array (was "<the id>")`. The package's `NominalPipe` handles this: see [How to use nominal types with NestJS](../frameworks/nestjs.md).
- This page is about types used inside another library. To build a type from another library's schema, see [How to declare a type](../core/declare-a-type.md).

## See also

- [Schemas reference](../../reference/schemas.md): `schemaOf()` and its chain.
- [How to accept lists, missing values and null](../core/lists-and-optional-values.md)
- [How to use nominal types with NestJS](../frameworks/nestjs.md)
- [Standard Schema website](https://standardschema.dev)

[← Guides](../README.md)
