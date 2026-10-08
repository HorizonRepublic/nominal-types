# How to generate test data

This guide shows how to test code with every kind of value a type allows, not a few you picked by hand. The values come from [fast-check](https://fast-check.dev), through the entry point `@horizon-republic/nominal-types/testing`.

## Before you start

- Install fast-check and Vitest: `npm install --save-dev fast-check vitest`.
- The examples test this file:

```ts
// orders.ts
import { AnyString, Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export const CreateOrder = n.object({
  customer: Email,
  sku: Sku,
  quantity: PositiveInteger,
  note: n.of(AnyString).optional(),
});

export type CreateOrderBody = ValueOf<typeof CreateOrder>;

export const summary = (order: CreateOrderBody): string =>
  `${order.quantity.value} × ${order.sku.value} for ${order.customer.domain}`;
```

## Test a function with every valid value

`arbitraryOf()` gives an [arbitrary](../../reference/glossary.md): a generator fast-check draws values from. A [property test](../../reference/glossary.md) runs your check on 100 of them.

Pass `{ as: 'instances' }` to get what `parse()` gives, ready for your function:

```ts
// orders.spec.ts
import fc from 'fast-check';
import { arbitraryOf } from '@horizon-republic/nominal-types/testing';
import { expect, it } from 'vitest';

import { CreateOrder, summary } from './orders.ts';

it('names the SKU of every order', () => {
  fc.assert(
    fc.property(arbitraryOf(CreateOrder, { as: 'instances' }), (order) => {
      expect(summary(order)).toContain(order.sku.value);
    }),
  );
});
```

Without the option, the values are the plain input, such as a request body. The orders hold the longest and the shortest email addresses, the largest quantities, and orders without a `note`.

When a check fails, fast-check shrinks the value: it prints the smallest value that still fails.

## Check that bad input is refused

`invalidArbitraryOf()` gives values the target refuses: valid values changed a little, and values of the wrong kind:

```ts
// orders.spec.ts
import fc from 'fast-check';
import { invalidArbitraryOf } from '@horizon-republic/nominal-types/testing';
import { expect, it } from 'vitest';

import { CreateOrder } from './orders.ts';

it('refuses every body that is a little wrong', () => {
  fc.assert(
    fc.property(invalidArbitraryOf(CreateOrder), (body) => {
      expect(CreateOrder.parse(body).ok).toBe(false);
    }),
  );
});
```

## Make fixtures

`sampleOf()` returns an array of valid values. Pass a `seed` to get the same values on every run:

```ts
import { sampleOf } from '@horizon-republic/nominal-types/testing';

import { CreateOrder, Sku } from './orders.ts';

sampleOf(Sku, 3, { seed: 42 }); // ['DUO-3918', 'VAL-0403', 'BLS-8701']
sampleOf(CreateOrder, 5, { as: 'instances' }); // five orders of instances
```

## Generate values for a type of your own

A type declared with a pattern, `n.oneOf()` or a JSON Schema needs nothing more. `Sku` above works as it is.

A type declared with a type guard alone gives nothing to generate from, so `arbitraryOf()` throws:

```ts
import { n, Nominal } from '@horizon-republic/nominal-types';
import { arbitraryOf } from '@horizon-republic/nominal-types/testing';

const isTicketCode = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('T') && value.length === 6;

class TicketCode extends Nominal('shop.TicketCode', n.satisfying(isTicketCode, 'a ticket code')) {}

arbitraryOf(TicketCode);
// throws TypeError: arbitraryOf(): no generator makes values of shop.TicketCode: …
```

Pass a generator of your own in `overrides`. It is used wherever the type appears, also inside an object:

```ts
import fc from 'fast-check';
import { n, Nominal } from '@horizon-republic/nominal-types';
import { sampleOf } from '@horizon-republic/nominal-types/testing';

const isTicketCode = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('T') && value.length === 6;

class TicketCode extends Nominal('shop.TicketCode', n.satisfying(isTicketCode, 'a ticket code')) {}

const overrides = new Map([[TicketCode, fc.stringMatching(/^T\d{5}$/u)]]);

sampleOf(TicketCode, 3, { seed: 1, overrides }); // ['T07464', 'T43627', 'T28752']
```

Run the tests:

```sh
npx vitest run
```

## See also

- [Testing](../../reference/testing.md): every function, option and error of the entry point.
- [How to test code that takes nominal types](write-tests.md)
- [fast-check documentation](https://fast-check.dev/docs/introduction/)

[← Guides](../README.md)
