# Nominal types in domain-driven design

How do nominal types fit domain-driven design (DDD)? This page maps the parts of the package to the ideas of DDD. Skip it if you don't use DDD.

DDD asks the code to speak the language of the business: a SKU, an amount, a stay, not a `string` and two `number`s. Nominal types give that language a home in TypeScript.

## Value objects

A [value object](../reference/glossary.md) is defined by its value and has no identity of its own. Two `Email`s with the same text are the same email.

A nominal type is a value object:

| Value object      | Nominal type                                                     |
| ----------------- | ---------------------------------------------------------------- |
| always valid      | `new` and `parse()` check the value; an invalid one never exists |
| immutable         | the value is read-only, and an object value is frozen            |
| equal by value    | `equals()` compares values, within one line of types             |
| has behaviour     | getters and methods on the class: `sku.category`                 |
| a type of its own | a `Sku` can't be passed where a `Username` goes                  |

A getter puts behaviour on the type:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {
  public get category(): string {
    return this.value.slice(0, 3);
  }
}

const sku = new Sku('ABC-1234');

sku.category; // 'ABC'
sku.equals(new Sku('ABC-1234')); // true
```

## Value objects of several fields

A value object often has more than one field: an amount and its currency, a stay with its guests and capacity. Its [invariant](../reference/glossary.md) is a rule that must always hold across those fields, such as "guests fit the room".

In this package, such a value object is a class on `n.object()`, with the invariant as an `n.constraint()`. A value that breaks the rule can't be built, so domain code never checks it again.

A value object never changes in place. `copyWith()` makes a new one, checked against the same invariant. [How to make a value object](../guides/core/make-a-value-object.md) shows the code.

## Bounded contexts and names

Each part of a system, a bounded context, has its own meaning for a word. An `Email` in billing may accept only company addresses, while an `Email` in accounts accepts any.

Put the context in the type name, before a dot:

```ts
// billing/email.ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Email extends AnyString.subtype('billing.Email', /^[^@\s]+@billing\.example$/u) {}
```

```ts
// accounts/email.ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Email extends AnyString.subtype('accounts.Email', /^[^@\s]+@[^@\s]+$/u) {}
```

What the names give you:

- The two types are different at compile time and at runtime, even with the same class name.
- Errors, JSON Schema and Swagger show the full name: `billing.Email: must be matched by …`.
- The built-in types live under `nominal.`, such as `nominal.Email`, so they never clash with yours.

Name the class like the last part of its name, `Email` here, so Swagger finds the type by the class name. [How to declare a type](../guides/core/declare-a-type.md) lists the naming rules.

## Keeping validation at the boundaries

In DDD, the domain shouldn't be busy parsing input. Plain input becomes domain values at the edges of the system. [Where checks belong](where-checks-belong.md#where-each-boundary-gets-its-types) lists what does it at each boundary.

On the way out, the [Swagger adapter](../guides/api-docs/swagger.md) describes the same types in the API document.

Past the boundary, functions take `Sku`, `Email` and `PositiveInteger`, never a `string` that might be anything. [Where checks belong](where-checks-belong.md) explains why.

## What it doesn't do

The package gives you value objects and invariants. [Entities](../reference/glossary.md) and [aggregates](../reference/glossary.md), with their identity and life cycle, stay your own classes. Their fields are nominal types:

```ts
import { AnyString, Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export class Order {
  public constructor(
    public readonly id: Uuid,
    public readonly customer: Email,
    public readonly sku: Sku,
    public readonly quantity: PositiveInteger,
  ) {}
}
```

## See also

- [How to make a value object](../guides/core/make-a-value-object.md)
- [Where checks belong](where-checks-belong.md)
- [Type hierarchy](type-hierarchy.md)

[← Explanation](README.md)
