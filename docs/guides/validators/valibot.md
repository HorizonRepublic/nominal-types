# How to use nominal types with Valibot

Put nominal types into [Valibot](https://valibot.dev) schemas and get instances back, such as an `Email`, instead of strings.

New project? Check bodies with [n.object()](../core/check-an-object.md). Use this guide if you already use Valibot.

## Before you start

- Install Valibot: `npm install valibot`.
- The helpers come from the [adapter](../../reference/glossary.md) `@horizon-republic/nominal-types/adapters/valibot`. It is a separate [entry point](../../reference/glossary.md): you need `valibot` only if you import it.
- It works with Valibot 1.

## Quick example

Use `toValibot()` for each field that holds a nominal type:

```ts
// orders.ts
import * as v from 'valibot';
import { toValibot } from '@horizon-republic/nominal-types/adapters/valibot';
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const CreateOrder = v.object({
  customer: toValibot(Email),
  sku: toValibot(Sku),
  quantity: toValibot(PositiveInteger),
  note: v.optional(v.string()),
});

const good = v.safeParse(CreateOrder, { customer: 'jane@example.com', sku: 'TEA-0042', quantity: 2 });
good.success && good.output.customer instanceof Email; // true

const bad = v.safeParse(CreateOrder, { customer: 'jane', sku: 'TEA-0042', quantity: 2 });
if (!bad.success) {
  v.flatten(bad.issues).nested; // { customer: ['must be an email address (was a string of 4 characters)'] }
}
```

The field checks the value with the type's own rules and messages, and gives the instance.

> Valibot's `v.parse()` throws a `ValiError` for a bad value. It is not the `parse()` of a nominal type, which returns `{ ok, issues }`. Use `v.safeParse()` to get a result object instead.

## Check a request body

`v.safeParse()` returns `{ success: true, output }` or `{ success: false, issues }`. Valibot's `v.InferOutput` gives the type of the result, with instances in place:

```ts
// orders.ts
import * as v from 'valibot';
import { toValibot } from '@horizon-republic/nominal-types/adapters/valibot';
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export const CreateOrder = v.object({
  customer: toValibot(Email),
  sku: toValibot(Sku),
  quantity: toValibot(PositiveInteger),
});
export type CreateOrder = v.InferOutput<typeof CreateOrder>;

export const placeOrder = (body: unknown): string => {
  const result = v.safeParse(CreateOrder, body);

  if (!result.success) {
    return `rejected: ${result.issues.map((issue) => issue.message).join('; ')}`;
  }

  const order: CreateOrder = result.output;

  return `order for ${order.customer.domain}`;
};

placeOrder({ customer: 'jane@example.com', sku: 'TEA-0042', quantity: 2 }); // 'order for example.com'
placeOrder({ customer: 'jane@example.com', sku: 'TEA-0042', quantity: 0 }); // 'rejected: must be a positive integer (was 0)'
```

## Lists and optional fields

Use Valibot's own `v.array()`, `v.optional()` and `v.nullable()` around `toValibot()`:

```ts
import * as v from 'valibot';
import { toValibot } from '@horizon-republic/nominal-types/adapters/valibot';
import { Email, Uuid } from '@horizon-republic/nominal-types';

const Invite = v.object({
  team: toValibot(Uuid),
  emails: v.pipe(v.array(toValibot(Email)), v.minLength(1), v.maxLength(50)),
  backup: v.optional(toValibot(Email)),
  manager: v.nullable(toValibot(Email)),
});

const result = v.safeParse(Invite, {
  team: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
  emails: ['jane@example.com', 'nope'],
  manager: null,
});

result.issues?.map((issue) => [v.getDotPath(issue), issue.message]);
// [['emails.1', 'must be an email address (was a string of 4 characters)']]
```

## Check fields together

A [constraint](../../reference/glossary.md) checks one field against another. Attach it to a Valibot object with `constrainValibot()`. It runs once every field of the object is valid, wherever the object sits:

```ts
import * as v from 'valibot';
import { constrainValibot, toValibot } from '@horizon-republic/nominal-types/adapters/valibot';
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = n.constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

const Stay = constrainValibot(
  v.object({ guests: toValibot(PositiveInteger), capacity: toValibot(PositiveInteger) }),
  withinCapacity,
);

const CreateBooking = v.object({ hotel: v.string(), stays: v.array(Stay) });

const result = v.safeParse(CreateBooking, { hotel: 'Lviv', stays: [{ guests: 4, capacity: 3 }] });

result.issues?.map((issue) => [v.getDotPath(issue), issue.message]);
// [['stays.0.guests', 'must not exceed the capacity']]
```

[How to check one field against another](../core/check-fields-together.md) explains `n.constraint()`.

## Errors

Each issue is a Valibot issue with the type's `message`. Read its path with `v.getDotPath(issue)`:

| Input                    | Path             | Message                                                   |
| ------------------------ | ---------------- | --------------------------------------------------------- |
| a field the type rejects | `customer`       | `must be an email address (was a string of 4 characters)` |
| a missing field          | `customer`       | `Invalid key: Expected "customer" but received undefined` |
| a constraint that fails  | `stays.0.guests` | `must not exceed the capacity`                            |

## Limits

- A constraint must read only fields the object declares. Otherwise `constrainValibot()` throws when you build the schema: `TypeError: constrainValibot: a constraint reads capacity, which the object does not declare`.
- A type that holds an object, such as one built on `n.object()`, reports a nested problem in one issue. The path stops at the field, and the rest goes into the message: `start: must be a positive integer (was 0)`.
- Building instances takes time. On a 3 MB document, Valibot alone takes 11 ms and Valibot with the adapter 15 ms: see [Benchmarks](../../reference/benchmarks.md#a-large-document).
- A `toValibot()` field carries no JSON Schema. To describe a body as JSON Schema, use [n.object()](../core/check-an-object.md) or another adapter.

## See also

- [Valibot adapter reference](../../reference/adapters/valibot.md): every export, its signature and errors.
- [How to check a request body with n.object()](../core/check-an-object.md)
- [How to check one field against another](../core/check-fields-together.md)

[← Guides](../README.md)
