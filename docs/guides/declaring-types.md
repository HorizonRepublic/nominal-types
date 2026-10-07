# Declaring types

A nominal type has two parts: a rule saying what a valid value looks like, and the behaviour that belongs to such a value.

## With a pattern

Pass `Nominal()` a unique name and a regular expression. For a string format it is enough, and it is also the fastest option:

```ts
import { matching, Nominal } from '@horizon-republic/nominal-types';

export class Slug extends Nominal('Slug', /^[a-z0-9]+(?:-[a-z0-9]+)*$/u) {}
export class Sku extends Nominal('Sku', matching(/^SKU-\d{4}$/u, 'a SKU')) {}
```

`matching()` adds a description, which error messages use: `must be a SKU (was "x")` instead of quoting the pattern. A pattern may carry the `u` flag and no other: `g` and `y` keep state between calls, and JSON Schema has no way to express `i`, `m` or `s`, so such patterns are refused when the type is declared. Spell case out in the character class instead, as in `[A-Fa-f]`.

The name brands the type at compile time and identifies it at runtime, so keep it unique among the nominal types one application loads.

## With a type guard

For a rule a pattern can't say, `satisfying()` takes a type guard, a description and, optionally, the JSON Schema it corresponds to:

```ts
import { Nominal, satisfying } from '@horizon-republic/nominal-types';

const isPercentage = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 100;

export class Percentage extends Nominal(
  'Percentage',
  satisfying(isPercentage, 'a percentage', { type: 'number', minimum: 0, maximum: 100 }),
) {}
```

## With a schema from a validation library

Any schema that supports [Standard Schema](https://standardschema.dev) and answers synchronously can define a type:

```ts
import { type } from 'arktype';
import { z } from 'zod';

export class Percentage extends Nominal('Percentage', type('0 <= number <= 100')) {}
export class Sku extends Nominal('Sku', z.string().regex(/^SKU-\d{4}$/u)) {}
```

Issues come back as plain `{ message, path }` objects whichever library produced them. A schema whose `validate` returns a Promise is refused, since construction is synchronous.

## Giving the type behaviour

A nominal type is also the place for the code that works on its values. Without one, that code ends up in helpers that take a string and hope it is the right kind:

```ts
// utils/order-number.ts
export const orderYear = (orderNumber: string): number => Number(orderNumber.slice(4, 8));
export const orderSequence = (orderNumber: string): number => Number(orderNumber.slice(8));
export const isExpressOrder = (orderNumber: string): boolean => orderNumber.startsWith('ORD-9');
```

Every caller has to find these helpers, and nothing stops one from passing a customer name. On the type, the same code is found by autocompletion and only ever runs on a value that passed the rule:

```ts
export class OrderNumber extends Nominal('OrderNumber', /^ORD-\d{8}$/u) {
  get year(): number {
    return Number(this.value.slice(4, 8));
  }

  get sequence(): number {
    return Number(this.value.slice(8));
  }

  get isExpress(): boolean {
    return this.value.startsWith('ORD-9');
  }
}

const order = new OrderNumber('ORD-20261007');

order.year; // 2026
order.isExpress; // false
```

Getters and methods read `this.value`, the validated value. A method that produces another value of the type returns an instance, so the result stays checked, the way `email.withoutTag()` returns an `Email`. The built-in types show the pattern: see [Built-in types](../reference/built-in-types.md).

[← Documentation](../README.md)
