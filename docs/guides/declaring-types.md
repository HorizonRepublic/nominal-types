# How to declare a type

This guide shows how to write the rule a type checks, in each of the three forms, and how to put behaviour on it.

When one of the [built-in types](../reference/types/README.md) already covers the kind of value, such as `AnyString` or `PositiveInteger`, declare the type under it instead, as [How to build on a type](building-on-types.md#starting-from-a-base-type) shows; the rules below then go into `subtype()`.

## Declaring with a pattern

For a string format, pass `Nominal()` a unique name and a regular expression:

```ts
import { matching, Nominal } from '@horizon-republic/nominal-types';

export class Slug extends Nominal('Slug', /^[a-z0-9]+(?:-[a-z0-9]+)*$/u) {}
export class Sku extends Nominal('Sku', matching(/^SKU-\d{4}$/u, 'a SKU')) {}
```

Wrap the pattern in `matching()` to give it a description, which messages then use: `must be a SKU (was "x")` instead of the pattern's source.

Give a pattern the `u` flag and no other; any other flag is refused when the type is declared. Where case doesn't matter, spell both cases out in the character class, as in `[A-Fa-f]`, rather than using `i`.

Keep the name unique among the nominal types one application loads: it identifies the type at runtime.

## Declaring with a type guard

For a rule a pattern can't express, pass `satisfying()` a type guard, a description and, if the type should describe itself as JSON Schema, the schema the guard corresponds to:

```ts
import { Nominal, satisfying } from '@horizon-republic/nominal-types';

const isPercentage = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 100;

export class Percentage extends Nominal(
  'Percentage',
  satisfying(isPercentage, 'a percentage', { type: 'number', minimum: 0, maximum: 100 }),
) {}
```

## Declaring with a schema from another library

To reuse a schema you already have, pass any [Standard Schema](https://standardschema.dev) that answers synchronously:

```ts
import { type } from 'arktype';
import { z } from 'zod';

export class Percentage extends Nominal('Percentage', type('0 <= number <= 100')) {}
export class Sku extends Nominal('Sku', z.string().regex(/^SKU-\d{4}$/u)) {}
```

Issues come back as plain `{ message, path }` objects whichever library produced them. A schema that validates asynchronously, such as one from Yup, can't define a type.

## Giving the type behaviour

Add getters and methods to the class. They read `this.value`, which always holds a value the rule accepted, so they need no checks of their own:

```ts
export class OrderNumber extends Nominal('OrderNumber', /^ORD-\d{8}$/u) {
  get year(): number {
    return Number(this.value.slice(4, 8));
  }

  get sequence(): number {
    return Number(this.value.slice(8));
  }

  get isExpress(): boolean {
    return this.value.charAt(8) === '9';
  }
}

const order = new OrderNumber('ORD-20261007');

order.year; // 2026
order.isExpress; // false
```

A method that produces another value of the type should return an instance, so the result is checked too, the way `email.withoutTag()` returns an `Email`. For why the code belongs on the type, see [How it works](../explanation/how-it-works.md#behaviour-on-the-type).

[← Documentation](../README.md)
