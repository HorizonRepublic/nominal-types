# How to keep values out of error messages

This guide shows how to stop rejected values, such as passwords and email addresses, from reaching API responses and logs.

By default, a message quotes the value it rejected: `must be a UUID (was "secret-password-123")`. A string longer than 64 characters is cut to its first 32 characters and its length. A schema made with [`fromEnv()`](read-config.md) hides all its values.

## Hide the values of one type

Declare the type with `{ sensitive: true }` as the third argument. Its messages then give only the kind and length of the value:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Password extends AnyString.subtype('shop.Password', /^.{12,}$/u, { sensitive: true }) {}

Password.parse('hunter2'); // { ok: false, issues: [{ message: 'must be matched by ^.{12,}$ (was a string of 7 characters)' }] }
new Password('hunter2'); // throws NominalError: shop.Password: must be matched by ^.{12,}$ (was a string of 7 characters)
```

To mark a type sensitive without a rule of its own, pass `undefined` as the rule:

```ts
import { PositiveInteger } from '@horizon-republic/nominal-types';

export class Salary extends PositiveInteger.subtype('hr.Salary', undefined, { sensitive: true }) {}

Salary.parse(-5000); // { ok: false, issues: [{ message: 'must be a positive integer (was a number)' }] }
```

What follows from it:

- Every check of the type hides the value: `new`, `parse()`, a field in `n.object()`, a list item and the adapters.
- Subtypes and variants of a sensitive type are sensitive too.
- A sensitive type made of an object hides the values of all its fields.
- The built-in `Email`, `E164PhoneNumber`, `IpAddress` with the types under it, `MacAddress`, `Iban` and `Jwt` are sensitive.

## Show the values of one subtype

Pass `{ sensitive: false }` to a subtype or variant of a sensitive type:

```ts
import { Email } from '@horizon-republic/nominal-types';

export class PublicEmail extends Email.subtype('shop.PublicEmail', undefined, { sensitive: false }) {}

PublicEmail.parse('jane'); // { ok: false, issues: [{ message: 'must be an email address (was "jane")' }] }
```

## Hide the values of every type

When you can't mark every type, hide values where messages leave your app.

In code of your own, such as a log line or an Express handler, call `n.hideValues()` on the issues:

```ts
import { n, Uuid } from '@horizon-republic/nominal-types';

const input: unknown = 'secret-password-123';
const result = Uuid.parse(input);

if (!result.ok) {
  console.warn(n.hideValues(result.issues)); // [{ message: 'must be a UUID (was a string of 19 characters)' }]
}
```

`n.hideValues()` changes the value at the end of a message, written as `(was "x")` by this package and ArkType, or `received "x"` by Valibot. It leaves other messages as they are.

To hide values in every message of the app, set [`values: 'length'`](configure.md#hide-values-in-every-message) once at startup.

The adapters take an `hideValues` option:

| Where   | Option                                                                           |
| ------- | -------------------------------------------------------------------------------- |
| NestJS  | `new NominalPipe({ hideValues: true })`, see [NestJS](../frameworks/nestjs.md)   |
| GraphQL | `toGraphQL(Uuid, { hideValues: true })`, see [GraphQL](../frameworks/graphql.md) |

## See also

- [Errors and messages](../../reference/errors-and-messages.md): how each kind of value is shown, and `n.hideValues()`.
- [How to configure messages, values and trimming](configure.md)
- [How to check untrusted input](check-input.md)

[← Guides](../README.md)
