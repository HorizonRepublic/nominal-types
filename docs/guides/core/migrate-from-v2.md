# How to move from version 2

Version 3 is a new library under the same name. This guide maps each part of version 2 to its replacement.

## Before you start

- Check the installed version with `npm ls @horizon-republic/nominal-types`. This guide is for `2.x`.
- Version 3 needs Node.js 22.12 or later.
- Install it:

  ```shell
  npm install @horizon-republic/nominal-types@3
  ```

- Version 3 has no dependencies. Each adapter needs its own library, which you install yourself: MikroORM 7, Nest 11 or 12, `@nestjs/swagger` 11 or 12, class-validator 0.14 or 0.15. The `uuid` package is no longer needed.

## What changed

| Version 2                                                                | Version 3                                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `NType({ name, validator })` with a class-validator constraint           | `AnyString.subtype('app.Name', /pattern/u)`, or `Nominal()` for objects                   |
| `new Email(text)` checks nothing; only the pipe and the decorators check | `new Email(text)` checks and throws `NominalError`; `Email.parse(input)` returns a result |
| `Type.createInstance(value)`                                             | `new Type(value)`                                                                         |
| `a.isIdentical(b)`                                                       | `a.equals(b)`                                                                             |
| `NominalTypeException`                                                   | `NominalError`                                                                            |
| `Type.getPipe()`                                                         | `new NominalPipe(Type)` from `adapters/nest`                                              |
| `Type.getOrmType()`                                                      | `toMikroOrm(Type)` from `adapters/mikro-orm`                                              |
| `Type.getResourceDecorators()`                                           | `@NominalField(Type)` from `adapters/class-validator`                                     |
| `static apiPropertyOptions`                                              | `applyNominalTypes()` from `adapters/swagger`, which reads the type's own JSON Schema     |

Built-in types:

| Version 2                                                                              | Version 3                                                       |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `Email`                                                                                | `Email`                                                         |
| `UUID`                                                                                 | `Uuid`                                                          |
| `UUID.generate()`                                                                      | `new Uuid(crypto.randomUUID())`                                 |
| `Url`                                                                                  | `HttpUrl` for web addresses, `Url` for any absolute URL         |
| `CountryCode2`                                                                         | `CountryCode`                                                   |
| `CountryCode3`, `CountryName`, `CountryNumber`, `FirstName`, `LastName`, `PhoneNumber` | none: declare your own, as in [Declare a type](#declare-a-type) |

Every path in the tables starts with `@horizon-republic/nominal-types/`, such as `@horizon-republic/nominal-types/adapters/nest`.

## Declare a type

A version 2 type needed a class-validator constraint and a `_nominalType` field. In version 3, a type is a class with a rule. Methods become getters in the class body:

```ts
// time24.ts
import { AnyString, n } from '@horizon-republic/nominal-types';

export class Time24 extends AnyString.subtype(
  'app.Time24',
  n.matching(/^(?:[01]?\d|2[0-3]):[0-5]\d$/u, 'a time such as 09:30'),
) {
  public get hour(): number {
    return Number(this.value.split(':')[0]);
  }
}

new Time24('09:30').hour; // 9
new Time24('25:00'); // throws NominalError: app.Time24: must be a time such as 09:30 (was "25:00")
```

The name, `'app.Time24'`, must be unique in your program. [How to declare a type](declare-a-type.md) shows the other kinds of rules.

## Check input with parse()

In version 2, `new` took any value. In version 3, `new` throws for a bad value. Where a value comes from outside, such as a request or a file, use `parse()`:

```ts
import { Email } from '@horizon-republic/nominal-types';

const input: unknown = 'jane@example';

const result = Email.parse(input);

if (!result.ok) {
  result.issues; // [{ message: 'must be an email address (was a string of 12 characters)' }]
}
```

Search your code for `new` of each type. Keep `new` where a bad value is a bug, and use `parse()` for input. [How to check untrusted input](check-input.md) explains the choice.

## Replace the NestJS pipe and the DTO decorators

`getPipe()` becomes `NominalPipe`, and the DTO decorators become `@NominalField()`:

```ts
// users.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Email, Uuid } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

export class InviteDto {
  @NominalField(Email)
  public email!: Email;
}

@Controller('users')
export class UsersController {
  @Get(':id')
  public find(@Param('id', new NominalPipe(Uuid)) id: Uuid) {
    return { id: id.value };
  }

  @Post('invite')
  public invite(@Body() invite: InviteDto) {
    return { domain: invite.email.domain };
  }
}
```

`GET /users/nope` answers `400` with `{"statusCode":400,"error":"Bad Request","message":["id: must be a UUID (was \"nope\")"]}`.

`@NominalField()` needs `ValidationPipe` with `transform: true`, as in [How to use nominal types with class-validator](../validators/class-validator.md#check-a-request-body-in-nestjs). For new code, [How to use nominal types with NestJS](../frameworks/nestjs.md) checks bodies without class-validator.

## Replace the MikroORM types

`getOrmType()` becomes `toMikroOrm()`. Version 3 needs MikroORM 7:

```ts
// user.entity.ts
import { defineEntity } from '@mikro-orm/core';
import { Email, Uuid } from '@horizon-republic/nominal-types';
import { toMikroOrm } from '@horizon-republic/nominal-types/adapters/mikro-orm';

export const User = defineEntity({
  name: 'User',
  properties: (p) => ({
    id: p.type(toMikroOrm(Uuid)).primary(),
    email: p.type(toMikroOrm(Email)),
  }),
});
```

With decorators, write `@Property({ type: toMikroOrm(Email) })`.

Two things change in the database:

- Version 3 checks every value it reads. A stored value the type refuses throws a `NominalError`, so check old rows before the upgrade.
- Columns come from the type, such as `varchar(254)` for `Email`. Run your migration tool to see the difference. [Database columns](../../reference/adapters/database-columns.md) lists them.

See [How to store nominal types with MikroORM](../databases/mikro-orm.md).

## Replace the Swagger options

Remove `apiPropertyOptions` from your types. Pass the Swagger document through `applyNominalTypes()`, as in [How to document nominal types in Swagger](../api-docs/swagger.md).

## See also

- [Tutorial: your first type](../../tutorials/01-first-type.md)
- [How to fix common problems](fix-common-problems.md)

[← Guides](../README.md)
