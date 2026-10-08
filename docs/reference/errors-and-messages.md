# Errors and messages

What a rejected value looks like: the error `new` throws, the issues `parse()` returns, the text of messages, and how values are hidden. Terms are explained in the [glossary](glossary.md).

## NominalError

```ts
class NominalError extends TypeError
```

Thrown by `new` and by `copyWith()` when a value breaks a rule. `parse()`, `validate` and the adapters return the same issues instead of throwing.

| Member     | Type               | Description                                                 |
| ---------- | ------------------ | ----------------------------------------------------------- |
| `name`     | `string`           | `'NominalError'`                                            |
| `typeName` | `string`           | The name of the type that rejected the value.               |
| `issues`   | `readonly Issue[]` | Every reason the value was rejected. See [Issues](#issues). |
| `message`  | `string`           | `<type name>: <issues>`.                                    |

`message` is the type name, a colon, then every issue joined by `; `. An issue with a path shows the path first, joined by dots:

```
nominal.Email: must be an email address (was a string of 4 characters)
booking.Stay: guests: must be a positive integer (was 0); capacity: must be a safe integer (was 1.5)
```

Example:

```ts
import { Email, NominalError } from '@horizon-republic/nominal-types';

try {
  new Email('jane');
} catch (error) {
  if (error instanceof NominalError) {
    error.typeName; // 'nominal.Email'
    error.message; // 'nominal.Email: must be an email address (was a string of 4 characters)'
    error.issues; // [{ message: 'must be an email address (was a string of 4 characters)' }]
  }
}
```

## Issues

An issue is one reason a value was rejected. Its type is `StandardSchemaV1.Issue` from `@standard-schema/spec`, which is installed with this package:

```ts
interface Issue {
  readonly message: string;
  readonly path?: readonly PropertyKey[];
}
```

| Field     | Description                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------- |
| `message` | What was wrong, without the type name: `must be a UUID (was "nope")`.                          |
| `path`    | Where the value was: field keys and array indexes, from the top. Missing for the value itself. |

Example: `{ message: 'must be a UUID (was "x")', path: ['items', 0] }` is the first item of the field `items`.

An issue from another library keeps its message. Its path segments become plain keys.

## Message format

Messages from `n.matching()`, `n.satisfying()`, `n.oneOf()` and the built-in types read:

```
must be <description> (was <value>)
```

The rejected value is written like this:

| Value            | Written as        |
| ---------------- | ----------------- |
| a string         | quoted: `"nope"`  |
| a number         | `42`, `-0`, `NaN` |
| a bigint         | `42n`             |
| a boolean        | `true`            |
| `undefined`      | `undefined`       |
| `null`           | `null`            |
| an array         | `array`           |
| any other object | `object`          |

Other messages:

| Case                                            | Message                                        |
| ----------------------------------------------- | ---------------------------------------------- |
| a pattern with no description                   | `must be matched by <pattern> (was "x")`       |
| a pattern given a value that is not a string    | `must be a string (was 42)`                    |
| `n.object()` or a constraint given a non-object | `must be an object (was "x")`                  |
| a key refused by `strict()`                     | `is not allowed`                               |
| `array()` counts and repeats                    | see [`array()`](schemas.md#array)              |
| a constraint's check returns `false`            | see [`n.constraint()`](schemas.md#nconstraint) |
| a rule from another library                     | that library's message                         |

## Sensitive types

A type declared with `{ sensitive: true }` leaves the rejected value out of its messages. It writes the kind of the value instead:

| Value         | Written as                                               |
| ------------- | -------------------------------------------------------- |
| a string      | `a string of 7 characters`, or `a string of 1 character` |
| `''`          | `an empty string`                                        |
| a number      | `a number`                                               |
| a bigint      | `a bigint`                                               |
| a boolean     | `a boolean`                                              |
| anything else | as before: `null`, `array`, `object`                     |

These facts hold for a sensitive type:

- Every check hides the value: `new`, `parse()`, `validate`, a field of `n.object()`, an array item and the adapters.
- For a type that holds an object, the values of all its fields are hidden.
- Its subtypes and variants are sensitive too. `{ sensitive: false }` turns it off for one of them.
- The built-in `Email`, `IpAddress` with the types under it, and `MacAddress` are sensitive.

Example:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

class Password extends AnyString.subtype('shop.Password', /^.{12,}$/u, { sensitive: true }) {}
class Pin extends Password.subtype('shop.Pin', /^\d+$/u, { sensitive: false }) {}

Password.parse('hunter2'); // issues: [{ message: 'must be matched by ^.{12,}$ (was a string of 7 characters)' }]
Password.parse(''); // issues: [{ message: 'must be matched by ^.{12,}$ (was an empty string)' }]
Password.parse(42); // issues: [{ message: 'must be a string (was a number)' }]
Pin.parse('correct horse'); // issues: [{ message: 'must be matched by ^\\d+$ (was "correct horse")' }]
```

See also: [`NominalOptions`](declaring.md#nominaloptions), [How to keep values out of error messages](../guides/core/hide-values.md).

## n.hideValues()

```ts
n.hideValues(issues: readonly Issue[]): readonly Issue[]
```

| Parameter | Type               | Description            |
| --------- | ------------------ | ---------------------- |
| `issues`  | `readonly Issue[]` | Issues from any check. |

Returns: the issues with the value at the end of each message written by its kind, as for a [sensitive type](#sensitive-types). Paths are kept. An issue it doesn't change is returned as it is.

It reads a value at the end of a message in two forms:

| Form           | Written by               |
| -------------- | ------------------------ |
| `(was "x")`    | this package and ArkType |
| `received "x"` | Valibot                  |

A message that names the value another way is left as it is.

Throws: nothing.

Example:

```ts
import { n, Uuid } from '@horizon-republic/nominal-types';

const result = Uuid.parse('secret-password-123');

if (!result.ok) {
  n.hideValues(result.issues); // [{ message: 'must be a UUID (was a string of 19 characters)' }]
}

n.hideValues([{ message: 'Invalid type: Expected string but received 42' }]);
// [{ message: 'Invalid type: Expected string but received a number' }]
```

See also: [How to keep values out of error messages](../guides/core/hide-values.md).

## Errors when declaring and describing

These are `TypeError`s for a mistake in the code, not in the input:

| When                                                                                                                            | Message                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| declaring a type with an invalid name                                                                                           | `"billing/Invoice" is not a valid type name: use letters, digits, _ and -, with dots between parts, such as billing.InvoiceNumber`                                                                                                           |
| a `RegExp` with a flag other than `u`                                                                                           | `/^[a-z]+$/i: only the u flag is supported, since JSON Schema patterns carry no flags`                                                                                                                                                       |
| an `n.object()` field with a reserved name, given to `Nominal()`                                                                | `a type built on n.object() cannot have a field named value: every instance has a member of that name`                                                                                                                                       |
| an `n.object()` field named `__proto__`                                                                                         | `n.object(): a field cannot be named __proto__`                                                                                                                                                                                              |
| a constraint that lists a field its object doesn't declare                                                                      | `n.object: a constraint reads capacity, which the object does not declare`; from `subtype()` or `variant()` of an object type, from the Zod or Valibot adapter it starts with `subtype:`, `variant:`, `constrainZod:` or `constrainValibot:` |
| `n.of()` given something else                                                                                                   | `n.of() takes a nominal type (was "Uuid")`                                                                                                                                                                                                   |
| `array()` with invalid options                                                                                                  | see [`ArrayOptions`](schemas.md#arrayoptions)                                                                                                                                                                                                |
| `n.oneOf()` with no values, a repeated value or a value of another kind                                                         | see [`n.oneOf()`](declaring.md#noneof)                                                                                                                                                                                                       |
| `fromString()` in the wrong place                                                                                               | see [`fromString()`](schemas.md#fromstring)                                                                                                                                                                                                  |
| checking a value with an asynchronous rule                                                                                      | `<type name>: asynchronous schemas are not supported`                                                                                                                                                                                        |
| JSON Schema for an unknown target                                                                                               | `JSON Schema target draft-04 is not supported`                                                                                                                                                                                               |
| JSON Schema of a type with a rule that has none: `n.satisfying()` with no `json`, or another library's schema with no converter | `<type name>: the schema cannot describe itself as JSON Schema`                                                                                                                                                                              |
| JSON Schema of an `n.satisfying()` rule alone, with no `json`                                                                   | `the schema cannot describe itself as JSON Schema`                                                                                                                                                                                           |
| JSON Schema of an `n.object()` or constraint field with none                                                                    | `a field of the object cannot describe itself as JSON Schema`, or `… of the constraint …`                                                                                                                                                    |
| comparing or converting an object instance                                                                                      | `booking.Stay holds an object and has no primitive value; compare its fields through .value`                                                                                                                                                 |

A type name used twice with different rules prints a warning instead. See [Type names](declaring.md#type-names).

[← Reference](README.md)
