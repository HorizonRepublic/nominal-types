# Errors and messages

What a rejected value looks like: the error `new` throws, the issues `parse()` returns, the text of messages, and how values are hidden. Terms are explained in the [glossary](glossary.md).

## NominalError

```ts
class NominalError extends TypeError
```

Thrown by `new` and by `copyWith()` when a value breaks a rule. `parseAsync()` rejects with it. `parse()`, `validate` and the adapters return the same issues instead of throwing.

`error instanceof NominalError` is also `true` for an error thrown by [another copy of the package](glossary.md), such as one loaded with `require` next to one loaded with `import`.

| Member     | Type               | Description                                                                                                     |
| ---------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `name`     | `string`           | `'NominalError'`                                                                                                |
| `typeName` | `string`           | The name of the type that rejected the value, or of the function that built the schema, such as `'n.object()'`. |
| `issues`   | `readonly Issue[]` | Every reason the value was rejected. See [Issues](#issues).                                                     |
| `message`  | `string`           | `<type name>: <issues>`.                                                                                        |

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

An issue is one reason a value was rejected. Its type is `StandardSchemaV1.Issue`, exported by this package:

```ts
interface Issue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
}
```

The paths this package builds hold plain keys, such as `['items', 0, 'sku']`. A rule from another library may add `{ key }` objects.

| Field     | Description                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------- |
| `message` | What was wrong, without the type name: `must be a UUID (was "nope")`.                          |
| `path`    | Where the value was: field keys and array indexes, from the top. Missing for the value itself. |

Example: `{ message: 'must be a UUID (was "x")', path: ['items', 0] }` is the first item of the field `items`.

An issue from another library keeps its message. Its path segments become plain keys.

With [`n.configure({ codes: true })`](configure.md#codes), every issue of this package also has a `code`, first: `{ code: 'required', message: 'is required', path: ['email'] }`. The type `NominalIssue` describes such an issue.

## Issue codes

A code names the kind of issue. Codes don't change between versions; messages may. An issue gets its code with [`codes: true`](configure.md#codes), and a [`messages`](configure.md#messages) map uses codes as its keys.

| Code             | When                                                                                                     | Message                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `not_a_string`   | a pattern or `AnyString` is given a value that is not a string                                           | `must be a string (was 42)`                   |
| `pattern`        | a pattern refuses a string: `n.matching()`, a `RegExp`, `Email`, `Uuid` and other built-in pattern types | `must be a UUID (was "nope")`                 |
| `invalid`        | any other rule of a type refuses the value: `n.satisfying()`, number, big integer, date and time types   | `must be a positive integer (was 0)`          |
| `not_one_of`     | `n.oneOf()` or the tag of `n.union()` refuses the value                                                  | `must be one of "draft", "paid" (was "lost")` |
| `not_an_object`  | `n.object()`, `n.union()` or a constraint is given a value that is not an object                         | `must be an object (was "x")`                 |
| `not_an_array`   | `array()` is given a value that is not an array                                                          | `must be an array (was "x")`                  |
| `too_few_items`  | an array has fewer items than `min` or `length`                                                          | `must have at least 2 items (was 1)`          |
| `too_many_items` | an array has more items than `max` or `length`                                                           | `must have at most 10 items (was 12)`         |
| `not_unique`     | an item of a `unique` array repeats an earlier one                                                       | `must not repeat an item (was "a")`           |
| `required`       | a field is missing or `undefined`                                                                        | `is required`                                 |
| `not_allowed`    | `strict()` or `copyWith()` gets a key the object doesn't declare                                         | `is not allowed`                              |
| `constraint`     | an `n.constraint()` check fails                                                                          | the constraint's message                      |

An issue from a rule of another library, such as a Zod schema, has no code.

## Message format

Messages from `n.matching()`, `n.satisfying()`, `n.oneOf()` and the built-in types read:

```
must be <description> (was <value>)
```

The rejected value is written like this:

| Value                       | Written as                                                    |
| --------------------------- | ------------------------------------------------------------- |
| a string                    | quoted: `"nope"`                                              |
| a string over 64 characters | `a string of 70 characters starting "<first 32 characters>"…` |
| a number                    | `42`, `-0`, `NaN`                                             |
| a bigint                    | `42n`                                                         |
| a boolean                   | `true`                                                        |
| `undefined`                 | `undefined`                                                   |
| `null`                      | `null`                                                        |
| an array                    | `array`                                                       |
| any other object            | `object`                                                      |

[`values`](configure.md#values) in `n.configure()` changes how the value is shown, or leaves it out. The value is the input as it was given. A bigint type given the string `'9223372036854775808'` writes `"9223372036854775808"`, not the bigint it was read as.

A string of up to 64 characters is quoted whole. A longer one is cut, so a large input doesn't make a large response. The message gives the length and the first 32 characters, then `…`:

```
must be <description> (was a string of <length> characters starting "<first 32 characters>"…)
```

Example:

```ts
import { Url } from '@horizon-republic/nominal-types';

Url.parse(`example.com/${'a'.repeat(29_988)}`);
// { ok: false, issues: [{ message: 'must be a URL (was a string of 30000 characters starting "example.com/aaaaaaaaaaaaaaaaaaaa"…)' }] }
```

Other messages:

| Case                                            | Message                                        |
| ----------------------------------------------- | ---------------------------------------------- |
| a pattern with no description                   | `must be matched by <pattern> (was "x")`       |
| a pattern given a value that is not a string    | `must be a string (was 42)`                    |
| `n.object()` or a constraint given a non-object | `must be an object (was "x")`                  |
| a required field that is missing or `undefined` | `is required`                                  |
| a key refused by `strict()` or `copyWith()`     | `is not allowed`                               |
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

A long string is hidden the same way: `a string of 30000 characters`.

These facts hold for a sensitive type:

- Every check hides the value: `new`, `parse()`, `validate`, a field of `n.object()`, an array item and the adapters.
- For a type that holds an object, the values of all its fields are hidden.
- `console.log()` shows its instances without the value: `Email { value: <hidden, a string of 16 characters> }`.
- Its subtypes and variants are sensitive too. `{ sensitive: false }` turns it off for one of them.
- The built-in `Email`, `E164PhoneNumber`, `IpAddress` with the types under it, `MacAddress`, `Iban` and `Jwt` are sensitive.
- A schema made with [`fromEnv()`](schemas.md#objectschema) hides the values of all its fields in the same way.

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

| Form                                            | Written by               |
| ----------------------------------------------- | ------------------------ |
| `(was "x")`                                     | this package and ArkType |
| `(was a string of 70 characters starting "x"…)` | this package             |
| `received "x"`                                  | Valibot                  |

A message that names the value another way is left as it is. A message written by a [`messages` function](configure.md#messages) is written again by that function, with the value hidden.

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
