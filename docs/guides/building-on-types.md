# How to build on a type

This guide shows how to make a new type from an existing one. The examples use this `OrderNumber`, the same as in [Your first type](../tutorials/your-first-type.md):

```ts
import { AnyString } from '@horizon-republic/nominal-types';

export class OrderNumber extends AnyString.subtype('OrderNumber', /^ORD-\d{8}$/u) {
  get year(): number {
    return Number(this.value.slice(4, 8));
  }

  get sequence(): number {
    return Number(this.value.slice(8));
  }
}
```

## Choosing how

There are three tools. Pick one by what you need:

| You need                              | Use                 | New type | Works where the original is expected | Original works where the new one is expected |
| ------------------------------------- | ------------------- | -------- | ------------------------------------ | -------------------------------------------- |
| A stricter rule, or just another name | `subtype()`         | yes      | yes                                  | no                                           |
| More methods, same type               | `class … extends …` | no       | yes                                  | yes                                          |
| A different rule, same methods        | `variant()`         | yes      | no                                   | no                                           |

If you're not sure, use `subtype()`. [Type hierarchy](../explanation/type-hierarchy.md) explains why there are three.

## Starting from a base type

You can start your type from the closest [built-in type](../reference/types/README.md). This is optional: `Nominal()` works just as well. A base type simply keeps related types together and saves you from writing the same checks again.

```ts
import { AnyString, Integer, PositiveInteger } from '@horizon-republic/nominal-types';

export class Slug extends AnyString.subtype('Slug', /^[a-z0-9]+(?:-[a-z0-9]+)*$/u) {}
export class Quantity extends PositiveInteger.subtype('Quantity') {}

const total = (values: Integer[]): number => values.reduce((sum, next) => sum + next.value, 0);

total([new Quantity(3), new Integer(-1)]); // 2, because a Quantity is an Integer
```

Your type gets all the checks of the base type. Your own rule only sees values that already passed them. For example, a rule under `NonNegativeInteger` only ever sees whole numbers from 0 up.

## Adding a stricter rule

Pass `subtype()` a name and a rule:

```ts
export class ExpressOrderNumber extends OrderNumber.subtype('ExpressOrderNumber', /^ORD-\d{4}9/u) {}

const express = new ExpressOrderNumber('ORD-20269001');

express instanceof OrderNumber; // true
express.year; // 2026, the getter is inherited
new OrderNumber('ORD-20261007') instanceof ExpressOrderNumber; // false
```

The rule can be a regular expression, `matching()`, `satisfying()` or a schema from another library. A regular expression only works under a string type.

Need a limit on a built-in type, like a maximum? Make a subtype with that rule. Built-in types have no options for it:

```ts
import { NonNegativeInteger, satisfying } from '@horizon-republic/nominal-types';

const isAtMost100 = (value: unknown): value is number => typeof value === 'number' && value <= 100;

export class Percentage extends NonNegativeInteger.subtype(
  'Percentage',
  satisfying(isAtMost100, 'at most 100', { type: 'integer', maximum: 100 }),
) {}
```

## Giving a type a second name

Call `subtype()` with a name only:

```ts
import { Uint16, Uuid } from '@horizon-republic/nominal-types';

export class Port extends Uint16.subtype('Port') {}
export class UserId extends Uuid.subtype('UserId') {}
export class OrderId extends Uuid.subtype('OrderId') {}
```

The new type checks the same rules as the original. It still keeps values apart:

```ts
const listen = (port: Port): void => {};
const load = (id: UserId): void => {};

listen(new Port(8080)); // fine
listen(new Uint16(8080)); // compile error: a Uint16 is not a Port
load(new OrderId('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f')); // compile error
```

To turn a `Uint16` into a `Port`, use `Port.parse(value)`.

## Adding behaviour without a new type

Extend the class:

```ts
export class TrackedOrderNumber extends OrderNumber {
  get trackingUrl(): string {
    return `https://example.com/track/${this.value}`;
  }
}
```

You can also add a rule with `static schema`. It is checked when you call `new` on the subclass:

```ts
import { matching } from '@horizon-republic/nominal-types';

export class RecentOrderNumber extends OrderNumber {
  static override readonly schema = matching(/^ORD-202/u, 'an order from the 2020s');
}

new RecentOrderNumber('ORD-19990101'); // throws NominalError
```

> **Warning:** the subclass is the same type as its parent. Any `OrderNumber` is accepted where a `RecentOrderNumber` is expected, even one from 1999:
>
> ```ts
> const archive = (order: RecentOrderNumber): void => {};
>
> archive(new OrderNumber('ORD-19990101')); // compiles and runs
> ```
>
> If the rule must hold everywhere, use `subtype()` instead.

## Accepting different values with the same behaviour

`variant()` makes a sibling type. It keeps the original's methods but swaps the original's rule for a new one:

```ts
import { matching } from '@horizon-republic/nominal-types';

export class LegacyOrderNumber extends OrderNumber.variant(
  'LegacyOrderNumber',
  matching(/^ORD-\d{6}$/u, 'a six-digit legacy order number'),
) {}

const legacy = new LegacyOrderNumber('ORD-199912');

legacy.year; // 1999
legacy instanceof OrderNumber; // false
```

The rules above the original still apply. Here, that is the string check of `AnyString`.

> **Warning:** the inherited methods were written for the original's values. `sequence` reads from position eight. In a legacy number, that is the month:
>
> ```ts
> legacy.sequence; // 12, the month, not a sequence
> ```
>
> Check each inherited method, and override the ones that don't fit.

## Moving a value between types

Call `parse()` on the type you want. It checks the value against that type's rules:

```ts
ExpressOrderNumber.parse(new OrderNumber('ORD-20269001')); // { ok: true, value: ExpressOrderNumber }
OrderNumber.parse(new LegacyOrderNumber('ORD-199912')); // { ok: false, issues: [...] }
```

This works between a type and its subtypes, between a variant and its original, and between siblings. A value from an unrelated type is rejected, even if it would pass.

Don't cast with `as`. A cast compiles, but nothing checks the value:

```ts
const send = (order: OrderNumber): void => {};

send(legacy as unknown as OrderNumber); // compiles, and send() gets 'ORD-199912'
```

## Ordering the rules

Rules run from the base type down and stop at the first failure. So put cheap checks first and expensive ones lower:

- a regular expression on the type;
- a heavier check, such as a checksum, in a subtype.

A value that fails the regular expression never reaches the expensive check. [Performance](../explanation/performance.md#how-a-chain-runs) shows how this runs.

[← Documentation](../README.md)
