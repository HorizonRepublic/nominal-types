# Nominal types in domain-driven design

Domain-driven design asks the code to speak the language of the business: an invoice number, an amount, a stay, not a `string` and two `number`s. Nominal types give that language a home in TypeScript. This page shows how the pieces of the package map to the ideas of DDD.

## Value objects

A value object is defined by its value and has no identity of its own. Two `Email`s with the same text are the same email.

A nominal type is a value object:

| Value object      | Nominal type                                                     |
| ----------------- | ---------------------------------------------------------------- |
| always valid      | `new` and `parse()` check the value; an invalid one never exists |
| immutable         | the value is read-only, and an object value is frozen            |
| equal by value    | `equals()` compares values, within one line of types             |
| has behaviour     | getters and methods on the class: `email.domain`                 |
| a type of its own | an `InvoiceNumber` can't be passed where an `OrderNumber` goes   |

```ts
import { Nominal } from '@horizon-republic/nominal-types';

export class InvoiceNumber extends Nominal('billing.InvoiceNumber', /^INV-(\d{4})\d{4}$/u) {
  public get year(): number {
    return Number(this.value.slice(4, 8));
  }
}
```

## Invariants across fields

An invariant is a rule that must always hold, often across several fields: a stay ends after it starts, guests fit the room. Write it once as a `constraint()` and make a type of it:

```ts
import { constraint, Nominal, PositiveInteger } from '@horizon-republic/nominal-types';

export class Occupancy extends Nominal(
  'booking.Occupancy',
  constraint(
    { guests: PositiveInteger, capacity: PositiveInteger },
    ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
    { path: 'guests' },
  ),
) {
  public get free(): number {
    return this.value.capacity.value - this.value.guests.value;
  }
}
```

An `Occupancy` that breaks the rule can't be built, so the domain code never checks it again.

## Value objects of several fields

A value object often has more than one field: an amount and its currency, a stay with its guests and capacity. Build it on `objectOf()`, with the invariant as a constraint:

```ts
import { constraint, Nominal, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

export class Stay extends Nominal(
  'booking.Stay',
  objectOf(
    { guests: PositiveInteger, capacity: PositiveInteger },
    constraint(
      { guests: PositiveInteger, capacity: PositiveInteger },
      ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
      { path: 'guests' },
    ),
  ),
) {}

const stay = new Stay({ guests: 2, capacity: 3 });

stay.guests; // PositiveInteger
stay.copyWith({ guests: 3 }); // a new Stay, checked; stay itself never changes
```

`copyWith()` is how a value object changes in DDD: it never changes in place, and every new value is checked against the same invariant.

## Bounded contexts and names

Each part of a system, a bounded context, has its own meaning for a word. An `Email` in billing may accept only company addresses, while an `Email` in accounts accepts any.

Put the context in the type name, with a dot:

```ts
// billing/email.ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Email extends AnyString.subtype('billing.Email', /^.+@billing\.example$/u) {}
```

```ts
// accounts/email.ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Email extends AnyString.subtype('accounts.Email', /^.+@.+$/u) {}
```

- The two types are different at compile time and at runtime, even with the same class name.
- Errors, JSON Schema and Swagger show the full name: `billing.Email: must be …`.
- Name the class like the last part, `Email` here, so Swagger finds the type by the class name.
- The built-in types live under `nominal.`, such as `nominal.Email`, so they never clash with yours.

Names allow letters, digits, `_` and `-` in each part, and dots between parts. See [Naming a type](../guides/declaring-types.md#naming-a-type).

## Keeping validation at the boundaries

In DDD, the domain shouldn't be busy with parsing input. The package keeps validation at the edges of the system:

| Boundary                     | What turns plain input into domain values                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| an HTTP request or a message | an [ArkType schema](../guides/arktype.md) with `toArk()`, or [`NominalPipe`](../guides/nestjs.md) |
| a class-validator DTO        | [`@NominalField()`](../guides/class-validator.md)                                                 |
| an API document              | [Swagger](../guides/swagger.md) adapter                                                           |

Past the boundary, functions take `InvoiceNumber`, `Occupancy` and `Email`, never a `string` that might be anything.

## What it doesn't do

The package gives you value objects and invariants. Entities and aggregates, with their identity and life cycle, stay your own classes. Their fields are nominal types:

```ts
import { PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

export class Invoice {
  public constructor(
    public readonly number: InvoiceNumber,
    public readonly customer: Uuid,
    public readonly totalMinor: PositiveInteger,
  ) {}
}
```

[← Explanation](README.md)
