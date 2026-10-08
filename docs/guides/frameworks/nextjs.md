# How to use nominal types with Next.js

Next.js hands a server action a `FormData`, and a route handler a `Request`. Check what they hold with `parse()`, and the rest of your code gets instances, such as an `Email`. No adapter is needed.

## Before you start

- Install the package:

  ```sh
  npm install @horizon-republic/nominal-types
  ```

- This page uses Next.js 16 with the App Router.
- Keep `"strict": true` in `tsconfig.json`, as `create-next-app` sets it. Without it, TypeScript can't tell an accepted value from a refused one after `if (!order.ok)`.

## Quick example

A server action reads the form's fields with `Object.fromEntries()`. Fields arrive as text, so a number field reads it with [fromString()](../core/read-text-values.md):

```ts
// app/orders/actions.ts
'use server';

import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const CreateOrder = n.object({
  customer: Email,
  quantity: n.of(PositiveInteger).fromString(),
});

export interface OrderState {
  readonly message: string;
  readonly errors: readonly string[];
}

export async function createOrder(_state: OrderState, formData: FormData): Promise<OrderState> {
  const order = CreateOrder.parse(Object.fromEntries(formData));

  if (!order.ok) {
    return { message: '', errors: order.issues.map((issue) => issue.message) };
  }

  // order.value.customer is an Email, order.value.quantity a PositiveInteger
  return { message: `${order.value.quantity.value} for ${order.value.customer.domain}`, errors: [] };
}
```

## Show the errors in a form

Give the action to `useActionState()` in a client component:

```tsx
// app/orders/order-form.tsx
'use client';

import { useActionState } from 'react';

import { createOrder } from './actions';

export function OrderForm() {
  const [state, action] = useActionState(createOrder, { message: '', errors: [] });

  return (
    <form action={action}>
      <input name="customer" type="email" />
      <input name="quantity" type="number" />
      <button type="submit">Order</button>
      <p>{state.message}</p>
      <ul>
        {state.errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </form>
  );
}
```

What the form shows:

| Sent                    | Shown                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `jane`, `0`             | `must be an email address (was a string of 4 characters)`, `must be a positive integer (was 0)` |
| `jane@example.com`, `3` | `3 for example.com`                                                                             |

## Check a route handler

Parse the body or the search parameters. Answer with the issues when they are refused:

```ts
// app/api/orders/route.ts
import { Email, n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });
const Search = n.object({ ids: n.of(Uuid).array({ max: 100 }) });

export async function POST(request: Request): Promise<Response> {
  const order = CreateOrder.parse(await request.json());

  if (!order.ok) {
    return Response.json({ issues: order.issues }, { status: 400 });
  }

  return Response.json({ domain: order.value.customer.domain }, { status: 201 });
}

export function GET(request: Request): Response {
  const search = Search.parse({ ids: new URL(request.url).searchParams.getAll('ids') });

  if (!search.ok) {
    return Response.json({ issues: search.issues }, { status: 400 });
  }

  return Response.json({ ids: search.value.ids }); // each Uuid is written as its text
}
```

The answers:

```text
POST /api/orders {"customer":"jane@example.com","quantity":2}  201 {"domain":"example.com"}
POST /api/orders {"customer":"jane","quantity":0}              400 {"issues":[{"message":"must be an email address (was a string of 4 characters)","path":["customer"]},{"message":"must be a positive integer (was 0)","path":["quantity"]}]}
GET /api/orders?ids=0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f       200 {"ids":["0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"]}
GET /api/orders?ids=…&ids=nope                                400 {"issues":[{"message":"must be a UUID (was \"nope\")","path":["ids",1]}]}
```

`getAll()` always gives a list, so one `?ids=` value is a list of one.

## Errors

`parse()` never throws. A refused value gives `{ ok: false, issues }`, where each issue has a `message` and a `path`. See [How to check untrusted input](../core/check-input.md).

To keep the typed values out of the messages, pass the issues through [n.hideValues()](../core/hide-values.md), or use a [sensitive type](../../reference/glossary.md).

## Limits

- `Object.fromEntries(formData)` keeps the last value of a repeated field. For a list, read it with `formData.getAll('tags')`.
- A field that reads text needs `n.of(Type).fromString()`. A plain `PositiveInteger` field gets `"3"` and refuses it.
- To send instances to client components, use [superjson](superjson.md).

## See also

- [How to check untrusted input](../core/check-input.md)
- [How to read numbers and booleans from text](../core/read-text-values.md)
- [How to send nominal types through superjson](superjson.md)

[← Guides](../README.md)
