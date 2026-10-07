# How to build on a type

This guide shows how to declare a type on top of another one: under a built-in type, with a stricter rule, under a second name, with more behaviour, or with different rules. The examples use the `OrderNumber` from [Your first type](../tutorials/your-first-type.md):

```ts
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

Pick by two questions: may the new type go where the original is expected, and may the original go where the new type is?

| You want                                               | Write                             | Rules checked                                                                | Passes where the original is expected | The original passes where it is expected |
| ------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| A new type with stricter rules, or a second name       | `Original.subtype('Name', rule?)` | the original's, then `rule`                                                  | yes                                   | no                                       |
| The same type with more behaviour                      | `class Name extends Original {}`  | the original's, then the class's own `schema` if it has one                  | yes                                   | yes                                      |
| A new type with different rules and the same behaviour | `Original.variant('Name', rule)`  | the rules above the original's level, then `rule` in place of the original's | no                                    | no                                       |

Neither `subtype()` nor `extends` can loosen what the original accepts. Only `variant()` replaces a rule, and the result is a separate type. [Type hierarchy](../explanation/type-hierarchy.md) explains why there are three.

## Starting from a base type

Declare a new type as a subtype of the closest [built-in type](../reference/types/README.md). It gets that type's checks and passes where that type is expected:

```ts
export class Slug extends AnyString.subtype('Slug', /^[a-z0-9]+(?:-[a-z0-9]+)*$/u) {}
export class Quantity extends PositiveInteger.subtype('Quantity') {}

const total = (values: Integer[]): number => values.reduce((sum, next) => sum + next.value, 0);

total([new Quantity(3), new Integer(-1)]); // 2: a Quantity is an Integer
```

The rule you add runs only on values the base accepted, so it can rely on them: a rule under `NonNegativeInteger` only sees whole numbers from 0 up.

## Adding a stricter rule

Pass `subtype()` a name and the rule: a pattern, `matching()` or `satisfying()` with a description, or a schema from any library. A pattern only applies under a string type.

```ts
export class ExpressOrderNumber extends OrderNumber.subtype('ExpressOrderNumber', /^ORD-\d{4}9/u) {}

const express = new ExpressOrderNumber('ORD-20269001');

express instanceof OrderNumber; // true
express.year; // 2026: behaviour is inherited
new OrderNumber('ORD-20261007') instanceof ExpressOrderNumber; // false
```

To put a limit of your own on a built-in type, such as an upper bound, declare a subtype with that rule rather than looking for an option:

```ts
const isAtMost100 = (value: unknown): value is number => typeof value === 'number' && value <= 100;

export class Percentage extends NonNegativeInteger.subtype(
  'Percentage',
  satisfying(isAtMost100, 'at most 100', { type: 'integer', maximum: 100 }),
) {}
```

## Giving a type a second name

Call `subtype()` without a rule. The new type checks exactly what the original checks, passes where the original is expected, and keeps apart from the original and from every other name:

```ts
export class Port extends Uint16.subtype('Port') {}
export class UserId extends Uuid.subtype('UserId') {}
export class OrderId extends Uuid.subtype('OrderId') {}

const listen = (port: Port): void => {};
const load = (id: UserId): void => {};

listen(new Port(8080)); // fine
listen(new Uint16(8080)); // compile error: a Uint16 is not yet a Port
load(new OrderId('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f')); // compile error
```

To turn an original into the new name, use `parse()`: `Port.parse(new Uint16(8080))`.

## Adding behaviour without a new type

Extend the class:

```ts
export class TrackedOrderNumber extends OrderNumber {
  get trackingUrl(): string {
    return `https://example.com/track/${this.value}`;
  }
}
```

A `static schema` in the subclass adds a rule, which values built through the subclass have to pass:

```ts
export class RecentOrderNumber extends OrderNumber {
  static override readonly schema = matching(/^ORD-202/u, 'an order from the 2020s');
}

new RecentOrderNumber('ORD-19990101'); // throws NominalError
```

> **The subclass is the same type as its parent, in both directions.** Its own rule applies when a value is built through the subclass, and promises nothing to code that receives one:
>
> ```ts
> const archive = (order: RecentOrderNumber): void => {};
>
> archive(new OrderNumber('ORD-19990101')); // compiles, and the instance check passes too
> ```
>
> Where the stricter rule has to hold for every receiver, declare a subtype.

## Accepting different values with the same behaviour

Call `variant()` with a name and the rule that replaces the original's own rule. The variant keeps the original's behaviour and the rules of the levels above it, and neither type passes for the other:

```ts
export class LegacyOrderNumber extends OrderNumber.variant(
  'LegacyOrderNumber',
  matching(/^ORD-\d{6}$/u, 'a six-digit legacy order number'),
) {}

const legacy = new LegacyOrderNumber('ORD-199912');

legacy instanceof OrderNumber; // false
legacy.year; // 1999
```

> **The inherited methods were written for the original's rules.** `sequence` reads the digits from position eight, where a six-digit legacy number keeps its month:
>
> ```ts
> legacy.sequence; // 12: the month, read as a sequence number
> ```
>
> Check every inherited method against the variant's values, and override the ones that no longer hold.

A variant of a subtype sits next to that subtype under the same parent, so it still passes where the parent is expected.

## Moving a value between types

Call `parse()` on the target type. It checks the value against the target's rules and builds an instance, or returns the issues:

```ts
ExpressOrderNumber.parse(new OrderNumber('ORD-20269001')); // { ok: true, value: ExpressOrderNumber }
OrderNumber.parse(new LegacyOrderNumber('ORD-199912')); // { ok: false, issues: [...] }
LegacyOrderNumber.parse(new OrderNumber('ORD-20261007')); // { ok: false, issues: [...] }
```

It works up and down a chain, between a variant and its original, and between types under a common parent. An instance of an unrelated type is rejected even when its value would pass.

Don't cast instead: a cast compiles and hands the receiver a value its type refuses.

```ts
const send = (order: OrderNumber): void => {};

send(legacy as unknown as OrderNumber); // compiles, and send() gets 'ORD-199912'
```

## Ordering the rules

Put cheap checks high in the chain and expensive ones low: a pattern on the type, a lookup or a computed check in a subtype. Rules run from the root down and stop at the first that fails, so a value the pattern refuses never reaches the expensive rule. [Performance](../explanation/performance.md#how-a-chain-runs) describes how a chain runs.

[← Documentation](../README.md)
