# How to use nominal types with Zod

Put nominal types into [Zod](https://zod.dev) schemas and get instances back, such as an `Email`, instead of strings.

New project? Check bodies with [n.object()](../core/check-an-object.md). Use this guide if you already use Zod.

## Before you start

- Install Zod: `npm install zod`.
- The helpers come from the [adapter](../../reference/glossary.md) `@horizon-republic/nominal-types/adapters/zod`. It is a separate [entry point](../../reference/glossary.md): you need `zod` only if you import it.
- It works with Zod 4.

## Quick example

Use `toZod()` for each field that holds a nominal type:

```ts
// orders.ts
import { z } from 'zod';
import { toZod } from '@horizon-republic/nominal-types/adapters/zod';
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const CreateOrder = z.object({
  customer: toZod(Email),
  sku: toZod(Sku),
  quantity: toZod(PositiveInteger),
  note: z.string().optional(),
});

const good = CreateOrder.safeParse({ customer: 'jane@example.com', sku: 'TEA-0042', quantity: 2 });
good.success && good.data.customer instanceof Email; // true

CreateOrder.safeParse({ customer: 'jane', sku: 'TEA-0042', quantity: 2 }).error?.issues;
// [{ code: 'custom', message: 'must be an email address (was a string of 4 characters)', path: ['customer'] }]
```

The field checks the value with the type's own rules and messages, and gives the instance.

> Zod's `parse()` throws a `ZodError` for a bad value. It is not the `parse()` of a nominal type, which returns `{ ok, issues }`. Use Zod's `safeParse()` to get a result object instead.

## Check a request body

`safeParse()` returns `{ success: true, data }` or `{ success: false, error }`. Zod's `z.infer` gives the type of the result, with instances in place:

```ts
// orders.ts
import { z } from 'zod';
import { toZod } from '@horizon-republic/nominal-types/adapters/zod';
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export const CreateOrder = z.object({ customer: toZod(Email), sku: toZod(Sku), quantity: toZod(PositiveInteger) });
export type CreateOrder = z.infer<typeof CreateOrder>;

export const placeOrder = (body: unknown): string => {
  const result = CreateOrder.safeParse(body);

  if (!result.success) {
    return `rejected: ${result.error.issues.map((issue) => issue.message).join('; ')}`;
  }

  const order: CreateOrder = result.data;

  return `order for ${order.customer.domain}`;
};

placeOrder({ customer: 'jane@example.com', sku: 'TEA-0042', quantity: 2 }); // 'order for example.com'
placeOrder({ customer: 'jane@example.com', sku: 'TEA-0042', quantity: 0 }); // 'rejected: must be a positive integer (was 0)'
```

## Lists and optional fields

Use Zod's own `z.array()`, `.optional()` and `.nullable()` around `toZod()`:

```ts
import { z } from 'zod';
import { toZod } from '@horizon-republic/nominal-types/adapters/zod';
import { Email, Uuid } from '@horizon-republic/nominal-types';

const Invite = z.object({
  team: toZod(Uuid),
  emails: z.array(toZod(Email)).min(1).max(50),
  backup: toZod(Email).optional(),
  manager: toZod(Email).nullable(),
});

Invite.safeParse({
  team: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
  emails: ['jane@example.com', 'nope'],
  manager: null,
}).error?.issues;
// [{ code: 'custom', message: 'must be an email address (was a string of 4 characters)', path: ['emails', 1] }]
```

## Check fields together

A [constraint](../../reference/glossary.md) checks one field against another. Attach it to a Zod object with `constrainZod()`. It runs once every field of the object is valid, wherever the object sits:

```ts
import { z } from 'zod';
import { constrainZod, toZod } from '@horizon-republic/nominal-types/adapters/zod';
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = n.constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

const Stay = constrainZod(
  z.object({ guests: toZod(PositiveInteger), capacity: toZod(PositiveInteger) }),
  withinCapacity,
);

const CreateBooking = z.object({ hotel: z.string(), stays: z.array(Stay) });

CreateBooking.safeParse({ hotel: 'Lviv', stays: [{ guests: 4, capacity: 3 }] }).error?.issues;
// [{ code: 'custom', message: 'must not exceed the capacity', path: ['stays', 0, 'guests'] }]
```

[How to check one field against another](../core/check-fields-together.md) explains `n.constraint()`.

## Describe the body as JSON Schema

Each `toZod()` field carries its type's JSON Schema. Ask Zod for the input side, which is what a client sends:

```ts
import { z } from 'zod';
import { toZod } from '@horizon-republic/nominal-types/adapters/zod';
import { Email, PositiveInteger } from '@horizon-republic/nominal-types';

const CreateOrder = z.object({ customer: toZod(Email), quantity: toZod(PositiveInteger) });

z.toJSONSchema(CreateOrder, { io: 'input' });
// { type: 'object', properties: { customer: { title: 'nominal.Email', type: 'string', format: 'email', … }, … } }
```

## Errors

Each issue is a Zod issue with `code: 'custom'`, the type's `message` and a `path`:

| Input                    | Issue                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| a field the type rejects | `{ code: 'custom', message: 'must be an email address (was a string of 4 characters)', path: ['customer'] }` |
| a missing field          | `{ code: 'custom', message: 'must be a string (was undefined)', path: ['customer'] }`                        |
| a constraint that fails  | `{ code: 'custom', message: 'must not exceed the capacity', path: ['stays', 0, 'guests'] }`                  |

## Limits

- A constraint must read only fields the object declares. Otherwise `constrainZod()` throws when you build the schema: `TypeError: constrainZod: a constraint reads capacity, which the object does not declare`.
- Building instances takes time. On a 3 MB document, Zod alone takes 6.8 ms and Zod with the adapter 9.1 ms: see [Benchmarks](../../reference/benchmarks.md#a-large-document).
- `z.toJSONSchema()` without `{ io: 'input' }` describes the output side. The output holds instances, which JSON Schema can't describe, so Zod throws `Error: Transforms cannot be represented in JSON Schema`.

## See also

- [Zod adapter reference](../../reference/adapters/zod.md): every export, its signature and errors.
- [How to check a request body with n.object()](../core/check-an-object.md)
- [How to check one field against another](../core/check-fields-together.md)
- [How to get a JSON Schema for a type](../api-docs/json-schema.md)

[← Guides](../README.md)
