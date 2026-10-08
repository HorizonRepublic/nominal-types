# How to use nominal types with tRPC

tRPC checks a procedure's input with the schema you give `.input()`. Give it a nominal schema or type, and the procedure gets instances, such as an `Email`. With superjson, the client gets instances back.

## Before you start

- Install the package, tRPC and superjson:

  ```sh
  npm install @horizon-republic/nominal-types @trpc/server @trpc/client superjson
  ```

- This page uses tRPC 11. No adapter is needed.

## Quick example

Pass the schema to `.input()` as it is:

```ts
// router.ts
import { initTRPC } from '@trpc/server';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const t = initTRPC.create();

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

export const appRouter = t.router({
  createOrder: t.procedure.input(CreateOrder).mutation(({ input }) => ({
    domain: input.customer.domain, // input.customer is an Email
    quantity: input.quantity.value,
  })),
});

export type AppRouter = typeof appRouter;
```

A call with `{ customer: 'jane@example.com', quantity: 2 }` returns `{ domain: 'example.com', quantity: 2 }`. A call with `{ customer: 'jane', quantity: 0 }` fails with `BAD_REQUEST`, and the procedure doesn't run.

## Take one value as input

Pass the type itself:

```ts
// router.ts
import { initTRPC } from '@trpc/server';
import { Uuid } from '@horizon-republic/nominal-types';

const t = initTRPC.create();

export const appRouter = t.router({
  user: t.procedure.input(Uuid).query(({ input }) => ({
    id: input.value,
    version: input.version, // 7 for '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'
  })),
});
```

For a list, pass `n.of(Uuid).array()`.

## Send instances to the client

Without a transformer, tRPC sends JSON, and an instance arrives as a string. Register each type with superjson, and use it on both sides. See [How to send nominal types through superjson](superjson.md):

```ts
// trpc.ts
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { Email, Uuid } from '@horizon-republic/nominal-types';
import { toSuperjson } from '@horizon-republic/nominal-types/adapters/superjson';

superjson.registerCustom(...toSuperjson(Email));
superjson.registerCustom(...toSuperjson(Uuid));

export const t = initTRPC.create({ transformer: superjson });
export { superjson };
```

Build the router with that `t`, and return instances:

```ts
// router.ts
import { Email, n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

import { t } from './trpc.ts';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

export const appRouter = t.router({
  createOrder: t.procedure.input(CreateOrder).mutation(({ input }) => ({
    id: new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'),
    customer: input.customer,
  })),
});

export type AppRouter = typeof appRouter;
```

Give the same `superjson` to the client's link:

```ts
// client.ts
import { createTRPCClient, httpLink } from '@trpc/client';

import type { AppRouter } from './router.ts';
import { superjson } from './trpc.ts';

const client = createTRPCClient<AppRouter>({
  links: [httpLink({ url: 'http://localhost:3000/trpc', transformer: superjson })],
});

const order = await client.createOrder.mutate({ customer: 'jane@example.com', quantity: 2 });

order.customer.domain; // 'example.com': order.customer is an Email, order.id a Uuid
```

The client still sends plain values, such as `'jane@example.com'`. The server's schema turns them into instances.

## Errors

A rejected input fails the call with the code `BAD_REQUEST`, status 400. The error's message names the schema and every issue:

```text
TRPCClientError: n.object(): customer: must be an email address (was a string of 4 characters); quantity: must be a positive integer (was 0)
```

On the server, `error.cause` is a [`NominalError`](../../reference/errors-and-messages.md#nominalerror). To send the issues to the client as data, add them in an `errorFormatter`:

```ts
// trpc.ts
import { initTRPC } from '@trpc/server';
import { NominalError } from '@horizon-republic/nominal-types';

export const t = initTRPC.create({
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      issues: error.cause instanceof NominalError ? error.cause.issues : undefined,
    },
  }),
});
// error.data.issues on the client:
// [{ message: 'must be an email address (was a string of 4 characters)', path: ['customer'] },
//  { message: 'must be a positive integer (was 0)', path: ['quantity'] }]
```

## Limits

- A class of your own with getters or methods: TypeScript doesn't see them on `input` until the class declares `StandardOf`. See [Classes with members of their own](../validators/standard-schema.md#classes-with-members-of-their-own).
- tRPC 10 is not supported. It calls a class as a function, so `.input(Email)` refuses every call, and it types the input of a schema as the result of `parse()`.

## See also

- [How to send nominal types through superjson](superjson.md)
- [How to check a request body with n.object()](../core/check-an-object.md)
- [How to use a type in any Standard Schema library](../validators/standard-schema.md)

[← Guides](../README.md)
