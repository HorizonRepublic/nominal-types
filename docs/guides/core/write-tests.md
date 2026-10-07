# How to test code that takes nominal types

This guide shows how to build test values, compare instances and check the issues of `parse()`. The examples use [Vitest](https://vitest.dev); Jest has the same `expect` calls.

## Before you start

- Install Vitest: `npm install --save-dev vitest`.
- The examples test this file:

```ts
// orders.ts
import { AnyString, Email, objectOf, PositiveInteger, schemaOf } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export const CreateOrder = objectOf({
  customer: Email,
  sku: Sku,
  quantity: PositiveInteger,
  note: schemaOf(AnyString).optional(),
});

export type CreateOrder = ValueOf<typeof CreateOrder>;

export const summary = (order: CreateOrder): string =>
  `${order.quantity.value} × ${order.sku.value} for ${order.customer.domain}`;
```

## Build test values with new

Make each value with `new`. A typo in a test value then fails at once with a `NominalError`:

```ts
// orders.spec.ts
import { Email, PositiveInteger } from '@horizon-republic/nominal-types';
import { expect, it } from 'vitest';

import { type CreateOrder, Sku, summary } from './orders.ts';

it('names the quantity, the SKU and the domain', () => {
  const order: CreateOrder = {
    customer: new Email('jane@example.com'),
    sku: new Sku('ABC-1234'),
    quantity: new PositiveInteger(2),
  };

  expect(summary(order)).toBe('2 × ABC-1234 for example.com');
});
```

## Compare instances

Use `toStrictEqual()`. It compares the value and the type:

```ts
// orders.spec.ts
import { Email, PositiveInteger } from '@horizon-republic/nominal-types';
import { expect, it } from 'vitest';

import { CreateOrder, Sku } from './orders.ts';

it('builds instances from a valid body', () => {
  const result = CreateOrder.parse({ customer: 'jane@example.com', sku: 'ABC-1234', quantity: 2 });

  expect(result).toStrictEqual({
    ok: true,
    value: {
      customer: new Email('jane@example.com'),
      sku: new Sku('ABC-1234'),
      quantity: new PositiveInteger(2),
    },
  });
});
```

Don't use these:

| Call        | Problem                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------ |
| `toBe()`    | fails for two instances with the same value: they are two objects                          |
| `toEqual()` | passes for two different types with the same value, such as an `Email` and a subtype of it |

In code outside `expect`, compare with `a.equals(b)`.

## Check the issues

Compare the whole result of `parse()`, with the messages and paths:

```ts
// orders.spec.ts
import { expect, it } from 'vitest';

import { CreateOrder } from './orders.ts';

it('reports every bad field with its path', () => {
  const result = CreateOrder.parse({ customer: 'jane', sku: 'ABC-1234', quantity: 0 });

  expect(result).toStrictEqual({
    ok: false,
    issues: [
      { message: 'must be an email address (was a string of 4 characters)', path: ['customer'] },
      { message: 'must be a positive integer (was 0)', path: ['quantity'] },
    ],
  });
});
```

## Check that new throws

Pass a function to `expect()`, then check the class or the message:

```ts
// orders.spec.ts
import { NominalError } from '@horizon-republic/nominal-types';
import { expect, it } from 'vitest';

import { Sku } from './orders.ts';

it('throws for a bad SKU', () => {
  expect(() => new Sku('abc')).toThrow(NominalError);
  expect(() => new Sku('abc')).toThrow('shop.Sku: must be matched by ^[A-Z]{3}-\\d{4}$ (was "abc")');
});
```

Run the tests:

```sh
npx vitest run
```

The summary ends with:

```
      Tests  4 passed (4)
```

## See also

- [Type members](../../reference/type-members.md): `equals()`, `parse()` and `new`.
- [Errors and messages](../../reference/errors-and-messages.md): the issue shape and every message.
- [How to check untrusted input](check-input.md)

[← Guides](../README.md)
