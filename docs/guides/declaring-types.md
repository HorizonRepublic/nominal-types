# How to declare a type

This guide shows the three ways to write a type's rule, and how to add methods to a type.

## Picking a way

| Your rule                                    | Use                  | Example                 |
| -------------------------------------------- | -------------------- | ----------------------- |
| A string format                              | a regular expression | an order number, a slug |
| Anything a regular expression can't say      | a type guard         | a number from 0 to 100  |
| A schema you already have in another library | that schema          | a Zod or ArkType schema |

The examples here use `Nominal()`, which starts a type from scratch. You can also start from a [built-in type](../reference/types/README.md) like `AnyString` or `PositiveInteger` with `subtype()`, as shown in [How to build on a type](building-on-types.md#starting-from-a-base-type). That is optional. It only helps keep related types together. The rules on this page work the same way in both.

## Declaring with a pattern

Pass `Nominal()` a name and a regular expression:

```ts
import { matching, Nominal } from '@horizon-republic/nominal-types';

export class Slug extends Nominal('Slug', /^[a-z0-9]+(?:-[a-z0-9]+)*$/u) {}
export class Sku extends Nominal('Sku', matching(/^SKU-\d{4}$/u, 'a SKU')) {}
```

`matching()` adds a description for error messages. With it, a bad value reads `must be a SKU (was "x")`. Without it, the message shows the pattern itself.

Keep in mind:

- Use the `u` flag and no other. Other flags are refused.
- To ignore case, list both cases, like `[A-Fa-f]`, instead of the `i` flag.
- Give each type a unique name. The name identifies the type at runtime.

## Declaring with a type guard

A type guard is a function that returns `true` for a valid value. Pass it to `satisfying()` with a description:

```ts
import { Nominal, satisfying } from '@horizon-republic/nominal-types';

const isPercentage = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 100;

export class Percentage extends Nominal(
  'Percentage',
  satisfying(isPercentage, 'a percentage', { type: 'number', minimum: 0, maximum: 100 }),
) {}
```

The third argument is optional. It is the JSON Schema for the same rule, used by [JSON Schema generation](json-schema.md).

## Declaring with a schema from another library

Pass the schema as the rule. It has to support [Standard Schema](https://standardschema.dev), as Zod, Valibot and ArkType do:

```ts
import { Nominal } from '@horizon-republic/nominal-types';
import { type } from 'arktype';
import { z } from 'zod';

export class Percentage extends Nominal('Percentage', type('0 <= number <= 100')) {}
export class Sku extends Nominal('Sku', z.string().regex(/^SKU-\d{4}$/u)) {}
```

Error messages come from that library. A library that only validates asynchronously, such as Yup, can't be used.

## Giving the type behaviour

Add getters and methods to the class:

```ts
export class OrderNumber extends Nominal('OrderNumber', /^ORD-\d{8}$/u) {
  get year(): number {
    return Number(this.value.slice(4, 8));
  }

  get isExpress(): boolean {
    return this.value.charAt(8) === '9';
  }
}

const order = new OrderNumber('ORD-20261007');

order.year; // 2026
order.isExpress; // false
```

`this.value` always holds a value that passed the rule, so methods don't need to check it.

If a method creates a new value of the same kind, return a new instance. Then the result is checked too. For example, `email.withoutTag()` returns an `Email`, not a string.

[← Guides](README.md)
