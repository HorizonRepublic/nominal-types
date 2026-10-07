# How to keep values out of error messages

This guide shows how to stop rejected values, such as passwords and email addresses, from reaching API responses and logs.

By default a message names the value it rejected:

```
must be a UUID (was "secret-password-123")
```

A client may have sent a password into the wrong field. The message then carries it into the response, and often into your logs.

## Hiding the value of one type

Declare the type with `sensitive: true`. Its messages then tell the value by its kind and length only:

```ts
import { Nominal } from '@horizon-republic/nominal-types';

export class Password extends Nominal('auth.Password', /^.{12,}$/u, { sensitive: true }) {}

Password.parse('hunter2');
// issues: [{ message: 'must be matched by ^.{12,}$ (was a string of 7 characters)' }]
```

The same works for `subtype()` and `variant()`, as the third argument:

```ts
import { PositiveInteger } from '@horizon-republic/nominal-types';

export const Salary = PositiveInteger.subtype('hr.Salary', undefined, { sensitive: true });

Salary.parse(-5000);
// issues: [{ message: 'must be a positive integer (was a number)' }]
```

- Every way of checking the type hides the value: `new`, `parse()`, a field in `objectOf()`, a list item and the adapters.
- Subtypes and variants of a sensitive type are sensitive too. Pass `{ sensitive: false }` to turn it off for one of them.
- For a type that holds an object, the values of all its fields are hidden.
- The built-in `Email` is sensitive, since an address is personal data.

## Hiding values at the edge of your application

You may not know every type that can hold personal data. Then hide values for all types where messages leave your application.

In NestJS, pass `hideValues` to `NominalPipe`:

```ts
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

app.useGlobalPipes(new NominalPipe({ hideValues: true }));
// 400: { "message": ["id: must be a UUID (was a string of 19 characters)"] }
```

The pipe hides the values before your `exceptionFactory` sees the issues.

In GraphQL, pass `hideValues` to `toGraphQL()`:

```ts
import { toGraphQL } from '@horizon-republic/nominal-types/adapters/graphql';
import { Uuid } from '@horizon-republic/nominal-types';

export const UuidScalar = toGraphQL(Uuid, { hideValues: true });
```

Anywhere else, such as Hono, Fastify or a log line, call `hideValues()` on the issues:

```ts
import { hideValues, Uuid } from '@horizon-republic/nominal-types';

const result = Uuid.parse(input);

if (!result.ok) {
  logger.warn(hideValues(result.issues));
}
```

## What is hidden

| Value     | Shown as                    |
| --------- | --------------------------- |
| a string  | `a string of 19 characters` |
| `''`      | `an empty string`           |
| a number  | `a number`                  |
| a bigint  | `a bigint`                  |
| a boolean | `a boolean`                 |
| an object | `object`, as before         |

`hideValues()` reads the value at the end of a message. It knows two forms: `(was "x")`, used by this package and ArkType, and `received "x"`, used by Valibot. A message from another library that names the value some other way is left as it is.

[← Guides](README.md)
