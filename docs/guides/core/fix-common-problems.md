# How to fix common problems

Each section starts with the error or the surprise, then gives its cause and the fix.

## Install and compile

### SyntaxError: Named export 'AnyString' not found

The full error:

```
SyntaxError: Named export 'AnyString' not found. The requested module '@horizon-republic/nominal-types' is a CommonJS module, which may not support all module.exports as named exports.
```

The compiler says `Module '"@horizon-republic/nominal-types"' has no exported member 'AnyString'.`

Cause: `npm install` gave you version 2. These docs describe version 3, which is not on npm yet. Version 2 has a different API.

Fix: check the version with `npm ls @horizon-republic/nominal-types`. With `2.x`, follow the README that comes with version 2.

### No error when one type is passed for another

`node main.ts` runs this code and prints `shipping jane_doe`:

```ts
// main.ts
import { AnyString } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}
class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {}

const ship = (sku: Sku): string => `shipping ${sku.value}`;

console.log(ship(new Username('jane_doe')));
```

Cause: Node runs TypeScript without checking types. The compiler, `tsc`, finds the mistake.

Fix: run `npx tsc --noEmit`, or let your editor run it. The first line of its output:

```
main.ts(9,18): error TS2345: Argument of type 'Username' is not assignable to parameter of type 'Sku'.
```

### A Uint8 is not accepted as a NonNegativeInteger

The compiler says `Argument of type 'Uint8' is not assignable to parameter of type 'NonNegativeInteger'.`

Cause: the sized types, such as `Uint8` and `Int32`, sit next to the sign types under `Integer`, not under them. See [Built-in number types](../../reference/types/number.md).

Fix: move the value with `parse()`:

```ts
import { NonNegativeInteger, Uint8 } from '@horizon-republic/nominal-types';

NonNegativeInteger.parse(new Uint8(3)); // { ok: true, value: NonNegativeInteger { value: 3 } }
```

## Declare a type

### Warning: the type name is declared twice

The full warning:

```
@horizon-republic/nominal-types: the type name "shop.Sku" is declared twice with different rules; the two types will pass for each other. Give each type a unique name.
```

Cause: two types with different rules use one name. Their instances pass for each other:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}
export class OtherSku extends AnyString.subtype('shop.Sku', /^\d{6}$/u) {}

new OtherSku('123456') instanceof Sku; // true
```

Fix: give each type its own name, such as `shop.Sku` and `warehouse.Sku`.

### TypeError: only the u flag is supported

The full error:

```
TypeError: /^[a-z]{3}-\d{4}$/iu: only the u flag is supported, since JSON Schema patterns carry no flags
```

Cause: the pattern has a flag other than `u`, such as `i`.

Fix: remove the flag. To accept both cases, list them: `/^[A-Za-z]{3}-\d{4}$/u`.

### TypeError: asynchronous schemas are not supported

The full error, for a type named `shop.Username`:

```
TypeError: shop.Username: asynchronous schemas are not supported
```

Cause: the rule comes from another library and checks asynchronously, such as a Zod `refine()` with an `async` function. The error comes when a value is checked.

Fix: keep the type's rule synchronous. Run the asynchronous check, such as a database lookup, in your own code after `parse()`.

### TypeError: the schema cannot describe itself as JSON Schema

The full error, for a type named `shop.Code`:

```
TypeError: shop.Code: the schema cannot describe itself as JSON Schema
```

Cause: something, such as Swagger, asked for the JSON Schema of a type whose rule has none. Two rules have none: a `satisfying()` type guard without its third argument, and a Valibot schema.

Fix: give `satisfying()` the JSON Schema of the rule as its third argument, as in [How to declare a type](declare-a-type.md#declare-a-type-with-a-type-guard). Replace a Valibot rule with a pattern or a Zod or ArkType schema.

### TypeError: cannot have a field named value

The full error:

```
TypeError: a type built on objectOf() cannot have a field named value: every instance has a member of that name
```

Cause: `value`, `equals`, `copyWith`, `toJSON`, `toString` and `constructor` are members of every instance.

Fix: rename the field, for example to `amount`. See [How to make a value object](make-a-value-object.md).

## Check values

### TypeError: fromString(): call it on schemaOf(Type) of a string, number, bigint or boolean type

The full error:

```
TypeError: fromString(): call it on schemaOf(Type) of a string, number, bigint or boolean type, before array(), optional() or nullable(); for an objectOf() schema, call fromEnv()
```

Cause: one of these:

- `fromString()` comes after `array()`, `optional()` or `nullable()`;
- the type was made with `Nominal()`, which has no text form.

Fix: call `fromString()` first, as in `schemaOf(PositiveInteger).fromString().array()`. Declare a string, number or boolean type under a built-in type: `AnyString.subtype('shop.Code', /^\d{4}$/u)`, not `Nominal('shop.Code', /^\d{4}$/u)`.

### must be a number (was "3000") for an environment variable

Cause: the field is wrapped in `schemaOf()`, for example to make it optional. `fromEnv()` reads only plain type fields from text.

Fix: add `fromString()` to the field: `schemaOf(Uint16).fromString().optional()`. See [How to read configuration from environment variables](read-config.md).

### TypeError: a constraint reads a field which the object does not declare

The full error:

```
TypeError: objectOf: a constraint reads capacity, which the object does not declare
```

Cause: the constraint lists a field that the object doesn't have:

```ts
import { constraint, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests.value <= capacity.value,
);

objectOf({ guests: PositiveInteger }, withinCapacity); // throws TypeError: objectOf: a constraint reads capacity, which the object does not declare
```

`constrainZod()` and `constrainValibot()` throw the same error, starting with their own name.

Fix: add the field to the object, or remove it from the constraint.

### Two equal values are not ===

Cause: each `new` makes a new object, so `===` compares two objects.

Fix: compare with `equals()`:

```ts
import { Email } from '@horizon-republic/nominal-types';

const a = new Email('jane@example.com');
const b = new Email('jane@example.com');

a === b; // false
a.equals(b); // true
```

In tests, use `toStrictEqual()`. See [How to test code that takes nominal types](write-tests.md).

### An email address that looks valid is rejected

`Email` rejects these addresses:

| Address              | Why                     |
| -------------------- | ----------------------- |
| `"jane"@example.com` | a quoted local part     |
| `jane@[127.0.0.1]`   | an IP address as domain |
| `jane@exämple.com`   | a non-Latin domain      |

Fix: convert a non-Latin domain to its `xn--` form before the check, with `domainToASCII()` from `node:url`:

```ts
import { domainToASCII } from 'node:url';

import { Email } from '@horizon-republic/nominal-types';

new Email(`jane@${domainToASCII('exämple.com')}`).value; // 'jane@xn--exmple-cua.com'
```

### Url accepts javascript: links

Cause: `Url` takes any absolute URL, with any scheme, such as `mailto:` and `javascript:`.

Fix: use `HttpUrl` for web addresses:

```ts
import { HttpUrl, Url } from '@horizon-republic/nominal-types';

Url.parse('javascript:alert(1)'); // { ok: true, value: Url { value: 'javascript:alert(1)' } }
HttpUrl.parse('javascript:alert(1)'); // { ok: false, issues: [{ message: 'must be an http or https URL (was "javascript:alert(1)")' }] }
```

## Use other libraries

### A NestJS parameter reaches the handler as undefined

With the global `NominalPipe`, `GET /users/find` without `email` calls this handler with `undefined`:

```ts
// users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { Email } from '@horizon-republic/nominal-types';

@Controller('users')
export class UsersController {
  @Get('find')
  find(@Query('email') email: Email) {
    return { found: email ?? null }; // {"found":null}
  }
}
```

Cause: TypeScript records `email: Email` and `email?: Email` the same way. The global pipe can't tell whether the value may be missing, so it lets a missing value through.

Fix: give the parameter a pipe of its own:

```ts
// users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { Email } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

@Controller('users')
export class UsersController {
  @Get('find')
  find(@Query('email', new NominalPipe(Email)) email: Email) {
    return { found: email };
  }
}
```

`GET /users/find` now answers `400` with `{"statusCode":400,"error":"Bad Request","message":["email: must be a string (was undefined)"]}`. For a value that may be missing, declare the parameter `email?: Email` instead.

### A Uuid[] parameter in NestJS reaches the handler unchecked

With the global `NominalPipe`, `GET /users?ids=nope` reaches this handler as the string `'nope'`:

```ts
// users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { Uuid } from '@horizon-republic/nominal-types';

@Controller('users')
export class UsersController {
  @Get()
  list(@Query('ids') ids: Uuid[]) {
    return { received: ids }; // {"received":"nope"}
  }
}
```

Cause: TypeScript records `Uuid[]` as `Array`, without the item type. The pipe can't see the items.

Fix: give the parameter a schema:

```ts
// users.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { schemaOf, Uuid } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

@Controller('users')
export class UsersController {
  @Get()
  list(@Query('ids', new NominalPipe(schemaOf(Uuid).array({ max: 100 }))) ids: readonly Uuid[]) {
    return { count: ids.length };
  }
}
```

`GET /users?ids=nope` now answers `400` with `{"statusCode":400,"error":"Bad Request","message":["ids.0: must be a UUID (was \"nope\")"]}`. See [How to use nominal types with NestJS](../frameworks/nestjs.md).

### A class-validator DTO holds strings instead of instances

Cause: `ValidationPipe` runs without `transform: true`. It checks the values but hands the handler the plain input.

Fix: register it as `new ValidationPipe({ transform: true })`. See [How to use nominal types with class-validator](../validators/class-validator.md#check-a-request-body-in-nestjs).

### A NestJS response shows { "value": … } instead of the value

The response is `{"email":{"value":"jane@example.com"}}` instead of `{"email":"jane@example.com"}`.

Cause: `ClassSerializerInterceptor` turns the response DTO into a plain object without calling `toJSON()` on its instances.

Fix: decorate each such property with `@NominalField()`:

```ts
// account.dto.ts
import { Email } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

export class AccountDto {
  @NominalField(Email)
  email!: Email;
}
```

See [How to use nominal types with class-validator](../validators/class-validator.md).

### Property 'ok' does not exist after Zod's parse()

The compiler says `Property 'ok' does not exist on type '{ email: Email; }'.`

Cause: Zod's own `parse()` returns the value and throws a `ZodError` for bad input. The `parse()` of this package returns `{ ok, value }` or `{ ok, issues }`.

Fix: use Zod's `safeParse()` for a result object:

```ts
import { Email } from '@horizon-republic/nominal-types';
import { toZod } from '@horizon-republic/nominal-types/adapters/zod';
import { z } from 'zod';

const SignUp = z.object({ email: toZod(Email) });

const result = SignUp.safeParse({ email: 'jane' });

if (!result.success) {
  result.error.issues.map((issue) => issue.message); // ['must be an email address (was a string of 4 characters)']
}
```

### TypeError: Class constructor Email cannot be invoked without 'new'

Cause: the type went into an ArkType schema without the adapter, as in `type({ email: Email })`. ArkType reads a class as something of its own.

Fix: use `toArk(Email)` from the adapter, as in [How to use nominal types with ArkType](../validators/arktype.md). Other libraries take `schemaOf(Email)`: see [How to use a type in any Standard Schema library](../validators/standard-schema.md).

### TypeError: fromArk: …

Cause: one of these:

- a morph after `toArk()`, such as `toArk(Email).pipe(…)`;
- a union of objects without a literal field that tells them apart.

Fix: see the limits in [How to use nominal types with ArkType](../validators/arktype.md#limits).

### Error: Invalid value Email { value: … } in a Sequelize query

Cause: an instance went into a Sequelize `where`. Sequelize checks `where` values itself and refuses objects.

Fix: pass the stored form, such as `email.value`. See [How to store nominal types with Sequelize](../databases/sequelize.md#query-by-a-value).

## See also

- [Errors and messages](../../reference/errors-and-messages.md)
- [How to check untrusted input](check-input.md)

[← Guides](../README.md)
