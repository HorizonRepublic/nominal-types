# How to declare a type

This guide shows how to declare your own type with a rule, a name and methods.

## Pick what to start from

Start from the built-in type closest to your value:

| Your value                  | Start from                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| a string                    | `AnyString`, or a closer built-in type such as `Email` or `Uuid`                                |
| a number                    | `AnyNumber`, or a closer built-in type such as `PositiveInteger`                                |
| a big integer               | `AnyBigInt`, or a closer built-in type such as `Int64`                                          |
| `true` or `false`           | `AnyBoolean`                                                                                    |
| an object of several fields | `Nominal()`, as in [How to make a value object](make-a-value-object.md)                         |
| a list                      | `Nominal()`, as in [How to accept lists, missing values and null](lists-and-optional-values.md) |

Only a type under a built-in type can be read from text with `fromString()` and `fromEnv()`. A string, number or boolean type made with `Nominal()` can't. [Built-in types](../../reference/types/README.md) lists them all.

## Declare a type with a pattern

Call `subtype()` with a name and a regular expression:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

new Sku('ABC-1234').value; // 'ABC-1234'
Sku.parse('abc-1234'); // { ok: false, issues: [{ message: 'must be matched by ^[A-Z]{3}-\d{4}$ (was "abc-1234")' }] }
```

The message quotes the pattern. To describe the value in words, wrap the pattern in `matching()`:

```ts
import { AnyString, matching } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype(
  'shop.Sku',
  matching(/^[A-Z]{3}-\d{4}$/u, 'a SKU such as ABC-1234'),
) {}

Sku.parse('abc-1234'); // { ok: false, issues: [{ message: 'must be a SKU such as ABC-1234 (was "abc-1234")' }] }
```

A pattern takes the `u` flag and no other. A pattern with `i`, `g` or any other flag throws a `TypeError`. To accept both cases, list them in the pattern:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Za-z]{3}-\d{4}$/u) {}

new Sku('abc-1234').value; // 'abc-1234'
```

## Declare a type with a type guard

A type guard is a function that returns `true` for a valid value. Use it when a pattern can't say the rule. Pass it to `satisfying()` with a description:

```ts
import { NonNegativeInteger, satisfying } from '@horizon-republic/nominal-types';

const isAtMost100 = (value: unknown): value is number => typeof value === 'number' && value <= 100;

export class Discount extends NonNegativeInteger.subtype(
  'shop.Discount',
  satisfying(isAtMost100, 'at most 100', { maximum: 100 }),
) {}

new Discount(15).value; // 15
Discount.parse(150); // { ok: false, issues: [{ message: 'must be at most 100 (was 150)' }] }
Discount.parse(-1); // { ok: false, issues: [{ message: 'must be a non-negative integer (was -1)' }] }
```

The guard only sees values that passed `NonNegativeInteger`, so it doesn't check for whole numbers again.

The third argument is the JSON Schema of the same rule, used in [generated JSON Schema](../api-docs/json-schema.md). It is optional. Without it, asking the type for its JSON Schema, as Swagger does, throws a `TypeError`.

## Declare a type for a fixed set of values

Pass the values to `oneOf()`:

```ts
import { AnyString, oneOf } from '@horizon-republic/nominal-types';

export class OrderStatus extends AnyString.subtype(
  'shop.OrderStatus',
  oneOf('draft', 'paid', 'shipped'),
) {}

new OrderStatus('paid').value; // 'paid'
OrderStatus.parse('Paid'); // { ok: false, issues: [{ message: 'must be one of "draft", "paid", "shipped" (was "Paid")' }] }
```

The type of `value` lists the values: `'draft' | 'paid' | 'shipped'`.

`oneOf()` takes strings, numbers, booleans and `null`. Start from `AnyString` for strings and from `AnyNumber` for numbers. Case counts, and `'1'` is not `1`.

To use a TypeScript `enum`, pass its values. For a string enum, spread `Object.values()`. For a numeric enum, list the members, since `Object.values()` also returns their names:

```ts
import { AnyNumber, AnyString, oneOf } from '@horizon-republic/nominal-types';

enum Size {
  Small = 'S',
  Large = 'L',
}

enum Priority {
  Low = 0,
  High = 1,
}

export class ShirtSize extends AnyString.subtype('shop.ShirtSize', oneOf(...Object.values(Size))) {}
export class TaskPriority extends AnyNumber.subtype(
  'shop.TaskPriority',
  oneOf(Priority.Low, Priority.High),
) {}

new ShirtSize(Size.Large).value; // 'L'
new TaskPriority(Priority.High).value; // 1
```

## Declare a type with a schema from another library

Pass a Zod, Valibot or ArkType schema as the rule:

```ts
import { AnyNumber, AnyString } from '@horizon-republic/nominal-types';
import { type } from 'arktype';
import { z } from 'zod';

export class Sku extends AnyString.subtype('shop.Sku', z.string().regex(/^[A-Z]{3}-\d{4}$/u)) {}
export class Discount extends AnyNumber.subtype('shop.Discount', type('0 <= number <= 100')) {}

Sku.parse('abc'); // { ok: false, issues: [{ message: 'Invalid string: must match pattern /^[A-Z]{3}-\d{4}$/u' }] }
Discount.parse(150); // { ok: false, issues: [{ message: 'must be at most 100 (was 150)' }] }
```

The library must support [Standard Schema](../../reference/glossary.md) and answer at once. The messages come from that library.

- A schema that checks asynchronously throws a `TypeError`. See [How to fix common problems](fix-common-problems.md#typeerror-asynchronous-schemas-are-not-supported).
- A Valibot schema has no JSON Schema. Asking the type for its JSON Schema throws a `TypeError`. Zod and ArkType schemas have one.

## Name the type

Write the name as the part of your system, a dot, and the type: `shop.Sku`, `billing.InvoiceNumber`. Name the class like the last part.

- A name is made of letters, digits, `_` and `-`, with dots between parts. Any other character throws a `TypeError`.
- Give each type its own name. Two different types with one name pass for each other, and the package prints a warning. See [How to fix common problems](fix-common-problems.md#warning-the-type-name-is-declared-twice).
- Built-in types are named under `nominal.`, so your own `shop.Email` doesn't clash with `Email`.

## Add methods

Add getters and methods to the class:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {
  get category(): string {
    return this.value.slice(0, 3);
  }

  next(): Sku {
    return new Sku(`${this.category}-${String(Number(this.value.slice(4)) + 1).padStart(4, '0')}`);
  }
}

const sku = new Sku('ABC-0041');

sku.category; // 'ABC'
sku.next().value; // 'ABC-0042'
```

`this.value` always holds a valid value, so a method doesn't check it again. Return a new instance from a method that makes a new value, so that value is checked too.

## See also

- [Declaring types](../../reference/declaring.md): `subtype()`, `Nominal()`, `matching()`, `satisfying()`, `oneOf()` and the name rules.
- [How to make a stricter type or a variant](build-on-a-type.md)
- [What a nominal type is](../../explanation/nominal-types.md)

[← Guides](../README.md)
