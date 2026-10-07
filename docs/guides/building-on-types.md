# Building on a type

Building on an existing type comes down to one question: may the result go where the original is expected, and may the original go where the result is?

| You want                                               | Write                             | Rules checked                                                                | Passes where the original is expected | The original passes where it is expected |
| ------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| A new type with stricter rules                         | `Original.subtype('Name', rule?)` | the original's, then `rule`                                                  | yes                                   | no                                       |
| The same type with more behaviour                      | `class Name extends Original {}`  | the original's, then the class's own `schema` if it has one                  | yes                                   | yes                                      |
| A new type with different rules and the same behaviour | `Original.variant('Name', rule)`  | the rules above the original's level, then `rule` in place of the original's | no                                    | no                                       |

Neither `subtype()` nor `extends` can loosen what the original accepts, since every inherited rule still runs. Only `variant()` replaces rules, and it pays for that by becoming a separate type.

## Subtypes

`subtype()` declares a new type that has to pass its parent's rules and, optionally, one more. An instance of the subtype is an instance of its parent, while a parent instance is not one of the subtype, both in the compiler and at runtime:

```ts
export class ExpressOrderNumber extends OrderNumber.subtype('ExpressOrderNumber', /^ORD-9/u) {}

const express = new ExpressOrderNumber('ORD-90000001');

express instanceof OrderNumber; // true
new OrderNumber('ORD-20261007') instanceof ExpressOrderNumber; // false
express.year; // 9000: behaviour is inherited
```

The rule runs on the value the parent accepted, and only when the parent accepted it. It can be a pattern, `matching()` or `satisfying()` with a description, or a schema from any library; a pattern only applies to a type whose value is a string. The built-in types keep their patterns as static fields, which helps when the extra rule builds on them:

```ts
export class CompanyEmail extends Email.subtype(
  'CompanyEmail',
  matching(/@example\.com$/u, 'a company address'),
) {}
```

Without a rule, `subtype()` gives a new type with exactly the parent's rules. That is how two kinds of identifier stay apart while being validated the same way:

```ts
export class UserId extends Uuid.subtype('UserId') {}
export class OrderId extends Uuid.subtype('OrderId') {}

const load = (id: UserId) => {};
load(new OrderId('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f')); // compile error
```

In JSON Schema a subtype becomes an `allOf` of every rule from the root down.

## Extending the class

A plain `extends` gives you the same type with more behaviour:

```ts
export class TrackedOrderNumber extends OrderNumber {
  get trackingUrl(): string {
    return `https://example.com/track/${this.value}`;
  }
}
```

A `static schema` in the subclass adds a rule on top of the parent's, and values built through the subclass have to pass both:

```ts
export class RecentOrderNumber extends OrderNumber {
  static override readonly schema = matching(/^ORD-202/u, 'an order from the 2020s');
}

new RecentOrderNumber('ORD-19990101'); // throws NominalError
```

> **The subclass is the same type as its parent, in both directions.** Its own rule applies when a value is built through the subclass, and promises nothing to code that receives one:
>
> ```ts
> const archive = (order: RecentOrderNumber) => {};
> archive(new OrderNumber('ORD-19990101')); // compiles, and the instance check passes too
> ```
>
> When the stricter rule has to hold wherever the type is expected, declare a subtype.

## Variants

`variant()` declares a type next to the original: it keeps the original's behaviour and the rules of the levels above it, and replaces the original's own rule. Neither passes for the other:

```ts
export class LegacyOrderNumber extends OrderNumber.variant(
  'LegacyOrderNumber',
  matching(/^ORD-\d{6}$/u, 'a six-digit legacy order number'),
) {}

const legacy = new LegacyOrderNumber('ORD-199912');

legacy instanceof OrderNumber; // false
legacy.year; // 1999
```

> **The inherited methods were written for the original's rules.** `OrderNumber.sequence` reads the digits from position eight, where a six-digit legacy number keeps its month:
>
> ```ts
> legacy.sequence; // 12: the month, read as a sequence number
> ```
>
> Check every inherited method against the variant's values, and override the ones that no longer hold.

A variant of a subtype sits next to that subtype under the same parent, so it still passes where the parent is expected.

## Moving a value between types

Never cast one nominal type to another. `parse()` moves a value instead: it checks the value against the target's rules and builds an instance of the target, or reports why it can't:

```ts
ExpressOrderNumber.parse(new OrderNumber('ORD-90000001')); // a parent narrowed to the subtype
OrderNumber.parse(new LegacyOrderNumber('ORD-199912')); // { ok: false, issues: [...] }
LegacyOrderNumber.parse(new OrderNumber('ORD-20261007')); // { ok: false, issues: [...] }
```

It works up and down a chain, between a variant and its original, and between types under a common parent. An instance of an unrelated type is rejected even when its value would pass.

```ts
send(legacy as unknown as OrderNumber); // compiles, and hands send() a value OrderNumber refuses
```

## Ordering the rules

Rules run from the root down and stop at the first that fails, so where a check sits decides how often it runs. Put the cheap checks at the top and the expensive ones below: a pattern on the root, a lookup or a computed check in a subtype. A value the pattern refuses never reaches the expensive rule.

Neighbouring patterns that start with `^` and hold no `|` are folded into one regular expression and tested in one pass; a pattern that needs `|` or matches anywhere in the string is tested on its own.

[← Documentation](../README.md)
