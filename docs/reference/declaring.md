# Declaring types

The functions and methods that declare a nominal type, and the rules a type checks with. Terms are explained in the [glossary](glossary.md).

| Entry                                                                       | What it does                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`Nominal()`](#nominal)                                                     | Declares a new type at the top of its own line of types     |
| [`subtype()`](#subtype)                                                     | Declares a narrower type under an existing one              |
| [`variant()`](#variant)                                                     | Declares a sibling type with a different rule               |
| [`NominalOptions`](#nominaloptions)                                         | Options of `Nominal()`, `subtype()`, `variant()`            |
| [`n.matching()`](#nmatching)                                                | A rule from a regular expression                            |
| [`n.satisfying()`](#nsatisfying)                                            | A rule from a type guard                                    |
| [`n.oneOf()`](#noneof)                                                      | A rule for a fixed set of values                            |
| [`PatternSchema` and `PredicateSchema`](#patternschema-and-predicateschema) | What `n.matching()` and `n.satisfying()` return             |
| [`OneOfSchema`](#oneofschema)                                               | What `n.oneOf()` returns                                    |
| [`n.isType()`](#nistype)                                                    | Tells a nominal type class from other values                |
| [Type names](#type-names)                                                   | What a name may hold, and what happens to a name used twice |
| [Rules from other libraries](#rules-from-other-libraries)                   | How a Zod, Valibot or ArkType schema runs as a rule         |
| [A `rule` set in a subclass](#a-rule-set-in-a-subclass)                     | What `static rule` does in a class that extends a type      |

## Nominal()

```ts
Nominal(name, rule, options?): NominalType
```

Declares a type with no parent. It returns a class to extend.

| Parameter | Type                                      | Description                                           |
| --------- | ----------------------------------------- | ----------------------------------------------------- |
| `name`    | `string`                                  | The [type name](#type-names), such as `booking.Stay`. |
| `rule`    | `RegExp` or a synchronous Standard Schema | What a valid value looks like.                        |
| `options` | [`NominalOptions`](#nominaloptions)       | Optional. `{ sensitive?: boolean }`.                  |

`rule` can be:

- a `RegExp`, which stands for `n.matching(pattern)`;
- the result of [`n.matching()`](#nmatching), [`n.satisfying()`](#nsatisfying) or [`n.oneOf()`](#noneof);
- a schema from [`n.object()`](schemas.md#nobject) or [`n.of()`](schemas.md#nof), such as `n.of(Uuid).array()`;
- an [`n.constraint()`](schemas.md#nconstraint);
- any [Standard Schema](glossary.md) that answers synchronously, such as a Zod, Valibot or ArkType schema.

A type with an `n.constraint()` as its rule gets no getters and no `copyWith()`. Keys the constraint doesn't list stay in `value` unchecked. A type built on `n.object()` with the constraint has getters and drops unlisted keys.

Returns: a class. Its static members are listed in [Type members](type-members.md#static-members). Built on `n.object()`, its instances also get a getter per field and `copyWith()`.

Throws:

| Case                                                | Error                                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `name` is not a valid type name                     | `TypeError: "billing/Invoice" is not a valid type name: use letters, digits, _ and -, with dots between parts, such as billing.InvoiceNumber` |
| a `RegExp` with a flag other than `u`               | `TypeError: /^[a-z]+$/i: only the u flag is supported, since JSON Schema patterns carry no flags`                                             |
| an `n.object()` field named like an instance member | `TypeError: a type built on n.object() cannot have a field named value: every instance has a member of that name`                             |

The reserved field names are `value`, `equals`, `copyWith`, `toJSON`, `toString` and `constructor`.

A type made with `Nominal()` has no [text form](glossary.md), so `n.of(Type).fromString()` throws for it. Types under a [base type](glossary.md) have one.

Example:

```ts
import { n, Nominal, PositiveInteger } from '@horizon-republic/nominal-types';

class Stay extends Nominal(
  'booking.Stay',
  n.object({ guests: PositiveInteger, capacity: PositiveInteger }),
) {}

new Stay({ guests: 2, capacity: 4 }).guests.value; // 2
new Stay({ guests: 0, capacity: 4 }); // throws NominalError: booking.Stay: guests: must be a positive integer (was 0)
```

See also: [How to declare a type](../guides/core/declare-a-type.md), [How to make a value object](../guides/core/make-a-value-object.md).

## subtype()

```ts
Type.subtype(name, rule?, options?): SubtypeOf<Type, Name>
```

Declares a narrower type under `Type`. It returns a class to extend.

| Parameter | Type                                      | Description                                                               |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `name`    | `string`                                  | The [type name](#type-names) of the new type.                             |
| `rule`    | `RegExp` or a synchronous Standard Schema | Optional. A rule added on top of the parent's rules.                      |
| `options` | [`NominalOptions`](#nominaloptions)       | Optional. Without it, the subtype keeps the parent's `sensitive` setting. |

`rule` takes what `Nominal()` takes, with two limits from the compiler:

- a `RegExp` only for a type whose value is a string;
- for a type built on `n.object()`, a [constraint](schemas.md#nconstraint) or a schema of the same object.

Returns: a class with the parent's rules, then its own rule. Its instances have the parent's methods.

An instance of the subtype is also an instance of the parent. It fits wherever the parent is expected. A parent instance doesn't fit where the subtype is expected.

Without `rule`, the subtype accepts the same values as its parent. It is still a new type.

A rule that allows fewer values, such as [`n.oneOf()`](#noneof), also narrows the type of `value`. Under `AnyString`, `n.oneOf('draft', 'paid')` gives `value` the type `'draft' | 'paid'`.

Throws: a `TypeError` for an invalid name or a `RegExp` flag, as [`Nominal()`](#nominal) does.

Example:

```ts
import { AnyString, Email } from '@horizon-republic/nominal-types';

class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {}
class StaffEmail extends Email.subtype('shop.StaffEmail', /@example\.com$/u) {}

new Username('jane_doe').value; // 'jane_doe'
new Username('J'); // throws NominalError: shop.Username: must be matched by ^[a-z0-9_]{3,20}$ (was "J")
new StaffEmail('jane@example.com') instanceof Email; // true
new StaffEmail('jane@gmail.com'); // throws NominalError: shop.StaffEmail: must be matched by @example\.com$ (was a string of 14 characters)
```

`StaffEmail` hides the value because `Email` is a [sensitive type](errors-and-messages.md#sensitive-types).

See also: [How to make a stricter type or a variant](../guides/core/build-on-a-type.md), [Type hierarchy](../explanation/type-hierarchy.md).

## variant()

```ts
Type.variant(name, rule, options?): VariantOf<Type, Name>
```

Declares a sibling of `Type`. The sibling has the methods of `Type` and a different rule. It returns a class to extend.

| Parameter | Type                                      | Description                                                                |
| --------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| `name`    | `string`                                  | The [type name](#type-names) of the new type.                              |
| `rule`    | `RegExp` or a synchronous Standard Schema | Required. The rule used in place of the rule of `Type`.                    |
| `options` | [`NominalOptions`](#nominaloptions)       | Optional. Without it, the variant keeps the `sensitive` setting of `Type`. |

`rule` has the same limits as in [`subtype()`](#subtype).

Returns: a class that checks:

1. the rules of the types above `Type`;
2. then `rule`, in place of the rule of `Type`.

A variant and `Type` don't pass for each other, at compile time or at runtime. Both still pass for the type above `Type`.

Throws: a `TypeError` for an invalid name or a `RegExp` flag, as [`Nominal()`](#nominal) does.

Example:

```ts
import { AnyString, n } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}
class LegacySku extends Sku.variant('shop.LegacySku', n.matching(/^[A-Z]{3}\d{6}$/u, 'a legacy SKU')) {}

new LegacySku('ABC123456').value; // 'ABC123456'
new LegacySku('ABC123456') instanceof Sku; // false
new LegacySku('ABC-1234'); // throws NominalError: shop.LegacySku: must be a legacy SKU (was "ABC-1234")
```

> [!WARNING]
> The variant inherits every method of `Type`. A method written for the values of `Type` may give wrong results for the values of the variant.

See also: [How to make a stricter type or a variant](../guides/core/build-on-a-type.md), [Type hierarchy](../explanation/type-hierarchy.md).

## NominalOptions

```ts
interface NominalOptions {
  readonly sensitive?: boolean;
}
```

The options of `Nominal()`, `subtype()` and `variant()`.

| Option      | Type      | Default                                                                     | Description                                               |
| ----------- | --------- | --------------------------------------------------------------------------- | --------------------------------------------------------- |
| `sensitive` | `boolean` | `false` for `Nominal()`; the parent's value for `subtype()` and `variant()` | `true` leaves rejected values out of the type's messages. |

A subtype or variant of a sensitive type is sensitive too. Pass `{ sensitive: false }` to turn it off for one of them.

A subtype with options and no rule of its own takes `undefined` as the rule.

Example:

```ts
import { AnyString, PositiveInteger } from '@horizon-republic/nominal-types';

class Password extends AnyString.subtype('shop.Password', /^.{12,}$/u, { sensitive: true }) {}
class Salary extends PositiveInteger.subtype('hr.Salary', undefined, { sensitive: true }) {}

Password.parse('correct horse battery').ok; // true
Password.parse('hunter2'); // { ok: false, issues: [{ message: 'must be matched by ^.{12,}$ (was a string of 7 characters)' }] }
Salary.parse(-5000); // { ok: false, issues: [{ message: 'must be a positive integer (was a number)' }] }
```

See also: [Sensitive types](errors-and-messages.md#sensitive-types), [How to keep values out of error messages](../guides/core/hide-values.md).

## n.matching()

```ts
n.matching(pattern, description?, json?): PatternSchema
```

A rule for strings that match a regular expression.

| Parameter     | Type                      | Description                                                                               |
| ------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `pattern`     | `RegExp`                  | The pattern. It may have the `u` flag or no flags.                                        |
| `description` | `string`                  | Optional. Ends the message `must be …`. Goes into the JSON Schema as `description`.       |
| `json`        | `Record<string, unknown>` | Optional. Keywords added to the JSON Schema, such as `format`, `maxLength` or `examples`. |

Returns: a [`PatternSchema`](#patternschema-and-predicateschema).

Messages:

| Case                          | Message                                    |
| ----------------------------- | ------------------------------------------ |
| a string the pattern rejects  | `must be <description> (was "abc")`        |
| the same, with no description | `must be matched by <pattern> (was "abc")` |
| a value that is not a string  | `must be a string (was 42)`                |

Its JSON Schema is `{ type: 'string', pattern }`, then the `json` keywords, then `description`.

Throws: `TypeError: /^[a-z]+$/i: only the u flag is supported, since JSON Schema patterns carry no flags`, for any flag other than `u`.

Example:

```ts
import { AnyString, n } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype(
  'shop.Sku',
  n.matching(/^[A-Z]{3}-\d{4}$/u, 'a SKU like ABC-1234', { examples: ['ABC-1234'] }),
) {}

new Sku('ABC-1234').value; // 'ABC-1234'
new Sku('abc'); // throws NominalError: shop.Sku: must be a SKU like ABC-1234 (was "abc")
```

See also: [How to declare a type](../guides/core/declare-a-type.md), [JSON Schema](json-schema.md).

## n.satisfying()

```ts
n.satisfying(check, description, json?): PredicateSchema
```

A rule for values that a [type guard](glossary.md) accepts.

| Parameter     | Type                             | Description                                                               |
| ------------- | -------------------------------- | ------------------------------------------------------------------------- |
| `check`       | `(value: unknown) => value is T` | Returns `true` for a valid value.                                         |
| `description` | `string`                         | Ends the message `must be …`. Goes into the JSON Schema as `description`. |
| `json`        | `Record<string, unknown>`        | Optional. The JSON Schema of the rule.                                    |

Returns: a [`PredicateSchema`](#patternschema-and-predicateschema).

The message for a rejected value is `must be <description> (was <value>)`.

Throws: nothing when declared. Without `json`, the rule has no JSON Schema. Asking for the JSON Schema of a type that uses it throws `TypeError: shop.PackSize: the schema cannot describe itself as JSON Schema`. For the rule alone, the message has no type name.

Example:

```ts
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

const isEven = (value: unknown): value is number =>
  typeof value === 'number' && value % 2 === 0;

class PackSize extends PositiveInteger.subtype(
  'shop.PackSize',
  n.satisfying(isEven, 'an even number', { type: 'integer', multipleOf: 2 }),
) {}

new PackSize(6).value; // 6
new PackSize(3); // throws NominalError: shop.PackSize: must be an even number (was 3)
```

See also: [How to declare a type](../guides/core/declare-a-type.md), [JSON Schema](json-schema.md).

## n.oneOf()

```ts
n.oneOf(...values): OneOfSchema<Value>
```

A rule for a fixed set of values, such as the states of an order.

| Parameter | Type                                                       | Description                            |
| --------- | ---------------------------------------------------------- | -------------------------------------- |
| `values`  | strings, finite numbers, booleans or `null` (`OneOfValue`) | The accepted values, each listed once. |

Returns: a [`OneOfSchema`](#oneofschema). The type of the value is the union of the listed values, such as `'draft' | 'paid'`.

A value passes when it is `===` to a listed value. Case counts, and the string `'1'` is not the number `1`.

Messages:

| Case             | Message                                                         |
| ---------------- | --------------------------------------------------------------- |
| several values   | `must be one of "draft", "paid" (was "lost")`                   |
| a single value   | `must be "admin" (was "user")`                                  |
| a sensitive type | `must be one of "draft", "paid" (was a string of 4 characters)` |

Its JSON Schema is `{ type, enum, description }`. `type` is there only when all values are of one kind: `string`, `integer`, `number` or `boolean`.

Throws:

| Case                                                   | Error                                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| no values                                              | `TypeError: n.oneOf(): list at least one value`                                           |
| a value listed twice                                   | `TypeError: n.oneOf(): "S" is listed twice`                                               |
| a bigint, `NaN`, an infinity, `undefined` or an object | `TypeError: n.oneOf(): values must be strings, finite numbers, booleans or null (was 1n)` |

Bigints are refused because JSON has no bigint. For a fixed set of big integers, use [`n.satisfying()`](#nsatisfying) under `AnyBigInt`.

Example:

```ts
import { AnyNumber, AnyString, n } from '@horizon-republic/nominal-types';

class OrderStatus extends AnyString.subtype('shop.OrderStatus', n.oneOf('draft', 'paid', 'shipped')) {}
class Rating extends AnyNumber.subtype('shop.Rating', n.oneOf(1, 2, 3, 4, 5)) {}

new OrderStatus('paid').value; // 'paid', of type 'draft' | 'paid' | 'shipped'
new OrderStatus('Paid'); // throws NominalError: shop.OrderStatus: must be one of "draft", "paid", "shipped" (was "Paid")
new Rating(5).value; // 5, of type 1 | 2 | 3 | 4 | 5
```

`n.oneOf()` doesn't take a TypeScript `enum` object, since a numeric enum also holds its member names. Pass the values instead:

```ts
import { AnyNumber, AnyString, n } from '@horizon-republic/nominal-types';

enum Size {
  Small = 'S',
  Large = 'L',
}

enum Priority {
  Low = 0,
  High = 1,
}

class ShirtSize extends AnyString.subtype('shop.ShirtSize', n.oneOf(...Object.values(Size))) {}
class TaskPriority extends AnyNumber.subtype('shop.TaskPriority', n.oneOf(Priority.Low, Priority.High)) {}

new ShirtSize(Size.Small).value; // 'S'
Object.values(Priority); // ['Low', 'High', 0, 1]
TaskPriority.parse('Low'); // { ok: false, issues: [{ message: 'must be a number (was "Low")' }] }
```

`Object.values()` fits a string enum only. For a numeric enum, list its members.

See also: [How to declare a type](../guides/core/declare-a-type.md#declare-a-type-for-a-fixed-set-of-values), [JSON Schema](json-schema.md).

## PatternSchema and PredicateSchema

The classes that `n.matching()` and `n.satisfying()` return. Both are Standard Schemas and Standard JSON Schemas. Create them through the functions, not with `new`.

| Member              | `PatternSchema`       | `PredicateSchema` | Description                                                                |
| ------------------- | --------------------- | ----------------- | -------------------------------------------------------------------------- |
| `accepts(value)`    | yes                   | yes               | `true` if the value passes the rule. A plain function you can pass around. |
| `messageFor(value)` | yes                   | yes               | The message for a rejected value.                                          |
| `issuesFor(value)`  | yes                   | yes               | The issues for a rejected value: `[{ message }]`.                          |
| `description`       | `string \| undefined` | `string`          | The description given to the function.                                     |
| `pattern`           | `RegExp`              | no                | The regular expression.                                                    |
| `['~standard']`     | yes                   | yes               | The Standard Schema interface: `validate` and `jsonSchema`.                |

Example:

```ts
import { n } from '@horizon-republic/nominal-types';

const sku = n.matching(/^[A-Z]{3}-\d{4}$/u, 'a SKU');
const isEven = (value: unknown): value is number => typeof value === 'number' && value % 2 === 0;
const even = n.satisfying(isEven, 'an even number');

sku.accepts('ABC-1234'); // true
sku.messageFor('abc'); // 'must be a SKU (was "abc")'
sku.messageFor(42); // 'must be a string (was 42)'
even.messageFor(3); // 'must be an even number (was 3)'
sku['~standard'].validate('abc'); // { issues: [{ message: 'must be a SKU (was "abc")' }] }
```

## OneOfSchema

The class `n.oneOf()` returns. It is a Standard Schema and a Standard JSON Schema. Create it through `n.oneOf()`, not with `new`.

| Member              | Description                                                          |
| ------------------- | -------------------------------------------------------------------- |
| `accepts(value)`    | `true` if the value is listed. A plain function you can pass around. |
| `messageFor(value)` | The message for a rejected value.                                    |
| `issuesFor(value)`  | The issues for a rejected value: `[{ message }]`.                    |
| `values`            | The listed values, in the order given, frozen.                       |
| `description`       | `one of "S", "M", "L"`, or the value alone when only one is listed.  |
| `['~standard']`     | The Standard Schema interface: `validate` and `jsonSchema`.          |

Example:

```ts
import { n } from '@horizon-republic/nominal-types';

const size = n.oneOf('S', 'M', 'L');

size.accepts('M'); // true
size.values; // ['S', 'M', 'L']
size.messageFor('XL'); // 'must be one of "S", "M", "L" (was "XL")'
size['~standard'].validate('XL'); // { issues: [{ message: 'must be one of "S", "M", "L" (was "XL")' }] }
```

## n.isType()

```ts
n.isType(value: unknown): value is AnyNominalType
```

| Parameter | Type      | Description        |
| --------- | --------- | ------------------ |
| `value`   | `unknown` | Any value to test. |

Returns: `true` if `value` is a nominal type class. That includes a class from [another copy of the package](glossary.md). An instance, a schema or any other value gives `false`.

Throws: nothing.

Example:

```ts
import { Email, n } from '@horizon-republic/nominal-types';

n.isType(Email); // true
n.isType(new Email('jane@example.com')); // false
n.isType(n.object({ email: Email })); // false
```

## Type names

Every type has a name, given to `Nominal()`, `subtype()` or `variant()`. The name appears in errors, in the `title` of the JSON Schema and in OpenAPI documents. `Type.typeName` returns it.

A valid name is one or more parts joined by dots. A part holds letters, digits, `_` and `-`. Examples: `Sku`, `shop.Sku`, `billing.InvoiceNumber`. Any other name throws a `TypeError` when the type is declared.

The built-in types are named under `nominal.`, such as `nominal.Email`. A type of your own may be called `shop.Email` without a clash.

A name must be unique in the application. Two types with one name share their brand, so they pass for each other. When a second type takes a name with different rules, the package warns once on the console:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}
class Coupon extends AnyString.subtype('shop.Sku', /^[A-Z0-9]{8}$/u) {}
// console: @horizon-republic/nominal-types: the type name "shop.Sku" is declared twice with different rules; the two types will pass for each other. Give each type a unique name.

new Coupon('SAVE2026') instanceof Sku; // true
```

Declaring the same type again, as a reloaded module or [another copy of the package](glossary.md) does, prints nothing.

## Rules from other libraries

Any [Standard Schema](glossary.md) can be a rule, if its `validate` answers synchronously. These facts hold for such a rule:

- The rules of a type run from the top of its line down. Each rule gets the value the rule before it gave back.
- The first rule that fails stops the check. Its issues are the result.
- The rule's own messages are kept. Each `path` segment becomes a plain key.
- The type has a JSON Schema only if the rule has a Standard JSON Schema converter, as ArkType and Zod schemas do. Otherwise asking for it throws `TypeError: <type name>: the schema cannot describe itself as JSON Schema`.

A schema that answers with a `Promise` makes the check throw `TypeError: <type name>: asynchronous schemas are not supported`. It throws when a value is checked, not when the type is declared.

Example:

```ts
import { Nominal } from '@horizon-republic/nominal-types';
import { z } from 'zod';

class Note extends Nominal('shop.Note', z.string().trim().max(200)) {}

new Note('  Leave at the door  ').value; // 'Leave at the door'
Note.parse('x'.repeat(201)); // { ok: false, issues: [{ message: 'Too big: expected string to have <=200 characters' }] }
```

See also: [How to use a type inside any Standard Schema library](../guides/validators/standard-schema.md).

## A `rule` set in a subclass

A class that extends a type can set `static rule`. The rule of the subclass then runs after the rules of the parent. It can't loosen them.

The subclass is the same type as its parent. It has the parent's name and brand.

```ts
import { AnyString, n } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

class ToySku extends Sku {
  static override readonly rule = n.matching(/^TOY-/u, 'a toy SKU');
}

new ToySku('ABC-1234'); // throws NominalError: shop.Sku: must be a toy SKU (was "ABC-1234")
new Sku('ABC-1234') instanceof ToySku; // true
```

> [!WARNING]
> The rule holds only for `new ToySku()` and `ToySku.parse()`. Any `Sku` passes where a `ToySku` is expected, at compile time and with `instanceof`. Use [`subtype()`](#subtype) when the rule must hold everywhere.

See also: [How to make a stricter type or a variant](../guides/core/build-on-a-type.md).

[← Reference](README.md)
