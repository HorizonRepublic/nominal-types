# How to fix common problems

Each section starts with the error or the surprise, then gives its cause and the fix.

## Install and compile

### SyntaxError: Named export 'AnyString' not found

The full error:

```
SyntaxError: Named export 'AnyString' not found. The requested module '@horizon-republic/nominal-types' is a CommonJS module, which may not support all module.exports as named exports.
```

The compiler says `Module '"@horizon-republic/nominal-types"' has no exported member 'AnyString'.`

Cause: the project has version 2 installed. These docs describe version 3, and version 2 has a different API.

Fix: check the version with `npm ls @horizon-republic/nominal-types`. With `2.x`, install version 3:

```shell
npm install @horizon-republic/nominal-types@3
```

Then port the code with [How to move from version 2](migrate-from-v2.md).

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

Cause: something, such as Swagger, asked for the JSON Schema of a type whose rule has none. Two rules have none: an `n.satisfying()` type guard without its third argument, and a Valibot schema.

Fix: give `n.satisfying()` the JSON Schema of the rule as its third argument, as in [How to declare a type](declare-a-type.md#declare-a-type-with-a-type-guard). Replace a Valibot rule with a pattern or a Zod or ArkType schema.

### TypeError: cannot have a field named value

The full error:

```
TypeError: a type built on n.object() cannot have a field named value: every instance has a member of that name
```

Cause: `value`, `equals`, `copyWith`, `toJSON`, `toString` and `constructor` are members of every instance.

Fix: rename the field, for example to `amount`. See [How to make a value object](make-a-value-object.md).

## Check values

### TypeError: fromString(): call it on n.of(Type) of a string, number, bigint or boolean type

The full error:

```
TypeError: fromString(): call it on n.of(Type) of a string, number, bigint or boolean type, before array(), optional() or nullable(); for an n.object() schema, call fromEnv()
```

Cause: one of these:

- `fromString()` comes after `array()`, `optional()` or `nullable()`;
- the type was made with `Nominal()`, which has no text form.

Fix: call `fromString()` first, as in `n.of(PositiveInteger).fromString().array()`. Declare a string, number or boolean type under a built-in type: `AnyString.subtype('shop.Code', /^\d{4}$/u)`, not `Nominal('shop.Code', /^\d{4}$/u)`.

### must be a number (was a string of 4 characters) for an environment variable

Cause: the field is wrapped in `n.of()`, for example to make it optional. `fromEnv()` reads only plain type fields from text.

Fix: add `fromString()` to the field: `n.of(Port).fromString().optional()`. See [How to read configuration from environment variables](read-config.md).

### TypeError: a constraint reads a field which the object does not declare

The full error:

```
TypeError: n.object: a constraint reads capacity, which the object does not declare
```

Cause: the constraint lists a field that the object doesn't have:

```ts
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = n.constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests.value <= capacity.value,
);

n.object({ guests: PositiveInteger }, withinCapacity); // throws TypeError: n.object: a constraint reads capacity, which the object does not declare
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

No lint rule finds `===` between two instances. Linters see the operator, not the types on each side.

### includes(), Set and Map don't find an equal value

Cause: `includes()`, `Set` and `Map` compare like `===`. They find the same object, not an equal one.

Fix: search with `equals()`, or keep the plain values in a `Set` or as `Map` keys:

```ts
import { Email } from '@horizon-republic/nominal-types';

const invited = [new Email('jane@example.com')];
const email = new Email('jane@example.com');

invited.includes(email); // false
invited.some((item) => item.equals(email)); // true

const seen = new Set(invited.map((item) => item.value));

seen.has(email.value); // true
```

### sort() puts 10 before 9

Cause: `sort()` without a compare function sorts by text. It compares `'10'` with `'9'`.

Fix: give `sort()` a compare function that reads `.value`:

```ts
import { PositiveInteger } from '@horizon-republic/nominal-types';

const counts = [new PositiveInteger(10), new PositiveInteger(9), new PositiveInteger(100)];

counts.sort(); // 10, 100, 9
counts.sort((a, b) => a.value - b.value); // 9, 10, 100
```

### A number becomes null in JSON

Cause: `AnyNumber` accepts `NaN` and `Infinity`. JSON has no such numbers, so `JSON.stringify()` writes `null`.

Fix: use `FiniteNumber`, or a type under it, for numbers you send:

```ts
import { AnyNumber, FiniteNumber } from '@horizon-republic/nominal-types';

JSON.stringify({ rating: new AnyNumber(Number.NaN) }); // '{"rating":null}'
FiniteNumber.parse(Number.NaN); // { ok: false, issues: [{ message: 'must be a finite number (was NaN)' }] }
```

### An instance comes back as a plain value

An `Email` put in a cache or a queue comes back as a string, and `instanceof Email` is `false`.

Cause: JSON and `structuredClone()` copy data, not classes. A cache or a queue stores the copy.

Fix: check the value again where it comes back, with `parse()`:

```ts
import { Email } from '@horizon-republic/nominal-types';

const message = JSON.stringify({ email: new Email('jane@example.com') }); // '{"email":"jane@example.com"}'
const { email }: { email: unknown } = JSON.parse(message);

Email.parse(email); // { ok: true, value: Email { value: 'jane@example.com' } }
```

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

Cause: `Url` takes any absolute URL, with any scheme, such as `javascript:`, `data:` and `file:`.

Fix: use `HttpUrl` for a link shown to users or opened by your server:

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

### A NestJS request body holds strings instead of instances

With the global `NominalPipe`, a handler declared as `create(@Body() order: CreateOrder)` gets the body as plain JSON. `order.customer` is a string, not an `Email`.

Cause: `CreateOrder` is a type made with `ValueOf`, not a class. TypeScript records the parameter as `Object`, so the global pipe doesn't know what to check, and passes the body on.

Fix: give `@Body()` the schema, as `@Body(new NominalPipe(CreateOrder))`. See [How to use nominal types with NestJS](../frameworks/nestjs.md#check-a-request-body).

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
import { n, Uuid } from '@horizon-republic/nominal-types';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

@Controller('users')
export class UsersController {
  @Get()
  list(@Query('ids', new NominalPipe(n.of(Uuid).array({ max: 100 }))) ids: readonly Uuid[]) {
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

Cause: `ClassSerializerInterceptor` turns the response into a plain object with class-transformer, which doesn't call `toJSON()` on instances.

Fix: register `NominalSerializerInterceptor` in its place. It takes the same arguments:

```ts
// main.ts
import { NestFactory, Reflector } from '@nestjs/core';
import { NominalSerializerInterceptor } from '@horizon-republic/nominal-types/adapters/nest';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new NominalSerializerInterceptor(app.get(Reflector)));
  await app.listen(3000);
}

void bootstrap();
```

A DTO property with `@NominalField()` from the [class-validator adapter](../validators/class-validator.md) is written as its value under either interceptor. See [Send instances in responses](../frameworks/nestjs.md#send-instances-in-responses).

### Swagger shows $ref "#/components/schemas/" under Bun or SWC

The request body in Swagger is `{ "$ref": "#/components/schemas/" }`. A global `ValidationPipe` answers `500` for the same route.

Cause: the schema and its type share one name, as in `const CreateOrder = n.object(…)` and `type CreateOrder = ValueOf<typeof CreateOrder>`. Bun and SWC then record the schema itself as the parameter's type, where `tsc` records `Object`.

Fix: give the type its own name:

```ts
// create-order.ts
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';

export const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });
export type CreateOrderBody = ValueOf<typeof CreateOrder>;
```

Declare the parameter as `order: CreateOrderBody`. To show the body in Swagger, see [Document a request body](../api-docs/swagger.md#document-a-request-body).

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

Fix: use `toArk(Email)` from the adapter, as in [How to use nominal types with ArkType](../validators/arktype.md). Other libraries take `n.of(Email)`: see [How to use a type in any Standard Schema library](../validators/standard-schema.md).

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
