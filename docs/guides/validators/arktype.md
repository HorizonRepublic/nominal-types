# How to use nominal types with ArkType

Put nominal types into [ArkType](https://arktype.io) schemas and get instances back, such as an `Email`, instead of strings.

New project? Check bodies with [n.object()](../core/check-an-object.md). Use this guide if you already use ArkType.

## Before you start

- Install ArkType: `npm install arktype`.
- The helpers come from the [adapter](../../reference/glossary.md) `@horizon-republic/nominal-types/adapters/arktype`. It is a separate [entry point](../../reference/glossary.md): you need `arktype` only if you import it.
- It works with ArkType 2.2 and later.

## Quick example

Mark each nominal field with `toArk()`, then wrap the whole schema in `fromArk()`:

```ts
// orders.ts
import { type } from 'arktype';
import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const CreateOrder = fromArk(
  type({ customer: toArk(Email), sku: toArk(Sku), quantity: toArk(PositiveInteger), 'note?': 'string' }),
);

const good = CreateOrder.parse({ customer: 'jane@example.com', sku: 'TEA-0042', quantity: 2 });
good.ok && good.value.customer instanceof Email; // true

CreateOrder.parse({ customer: 'jane', sku: 'TEA-0042', quantity: 2 });
// { ok: false, issues: [{ message: 'must be an email address (was a string of 4 characters)', path: ['customer'] }] }
```

`fromArk()` builds an instance for every `toArk()` field. The messages are the type's own.

## Check a request body

`parse()` never throws. It returns `{ ok: true, value }` or `{ ok: false, issues }`.

Name the type of its value with `ValueOf`. Give it a name of its own, such as `CreateOrderBody`: in NestJS, a type named like the schema breaks Swagger and pipes under Bun and SWC. See [Limits in the NestJS guide](../frameworks/nestjs.md#limits).

```ts
// orders.ts
import { type } from 'arktype';
import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export const CreateOrder = fromArk(
  type({ customer: toArk(Email), sku: toArk(Sku), quantity: toArk(PositiveInteger) }),
);
export type CreateOrderBody = ValueOf<typeof CreateOrder>;

export const placeOrder = (body: unknown): string => {
  const result = CreateOrder.parse(body);

  if (!result.ok) {
    return `rejected: ${result.issues.map((issue) => issue.message).join('; ')}`;
  }

  const order: CreateOrderBody = result.value;

  return `order for ${order.customer.domain}`;
};

placeOrder({ customer: 'jane@example.com', sku: 'TEA-0042', quantity: 2 }); // 'order for example.com'
placeOrder({ customer: 'jane@example.com', sku: 'TEA-0042', quantity: 0 }); // 'rejected: must be a positive integer (was 0)'
```

## Lists and optional fields

Use ArkType's own syntax around `toArk()`:

```ts
import { type } from 'arktype';
import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
import { Email, Uuid } from '@horizon-republic/nominal-types';

const Invite = fromArk(
  type({
    team: toArk(Uuid),
    emails: toArk(Email).array().atLeastLength(1).atMostLength(50),
    'backup?': toArk(Email),
    manager: toArk(Email).or('null'),
  }),
);

Invite.parse({ team: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', emails: ['jane@example.com', 'nope'], manager: null });
// { ok: false, issues: [{ message: 'must be an email address (was a string of 4 characters)', path: ['emails', 1] }] }
```

A union needs a way to tell its branches apart: by type, or by a literal field such as `kind`:

```ts
import { type } from 'arktype';
import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
import { Email, Uuid } from '@horizon-republic/nominal-types';

const Recipient = fromArk(
  type({
    to: type({ kind: "'email'", address: toArk(Email) }).or({ kind: "'user'", id: toArk(Uuid) }),
  }),
);

Recipient.parse({ to: { kind: 'email', address: 'jane@example.com' } });
// { ok: true, value: { to: { address: Email, kind: 'email' } } }
```

Tuples (`[toArk(Uuid), toArk(PositiveInteger)]`) and records (`{ '[string]': toArk(Email) }`) work too. The [ArkType adapter reference](../../reference/adapters/arktype.md) lists every supported form.

## Check fields together

A [constraint](../../reference/glossary.md) checks one field against another. Attach it to an ArkType object with `constrainArk()`. It runs on that object wherever the object sits, here inside a list:

```ts
import { type } from 'arktype';
import { constrainArk, fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = n.constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

const Stay = constrainArk(
  type({ guests: toArk(PositiveInteger), capacity: toArk(PositiveInteger) }),
  withinCapacity,
);

const CreateBooking = fromArk(type({ hotel: 'string', stays: Stay.array() }));

CreateBooking.parse({ hotel: 'Lviv', stays: [{ guests: 4, capacity: 3 }] });
// { ok: false, issues: [{ message: 'must not exceed the capacity', path: ['stays', 0, 'guests'] }] }
```

For the top object, pass the constraints to `fromArk()` itself: `fromArk(type({ … }), withinCapacity)`.

Constraints run only after ArkType has accepted the whole input. [How to check one field against another](../core/check-fields-together.md) explains `n.constraint()`.

## Describe the body as JSON Schema

The result of `fromArk()` describes itself as JSON Schema. Each `toArk()` field gets its type's pattern, format, limits and example:

```ts
import { type } from 'arktype';
import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
import { Email, PositiveInteger } from '@horizon-republic/nominal-types';

const CreateOrder = fromArk(type({ customer: toArk(Email), quantity: toArk(PositiveInteger) }));

CreateOrder['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { type: 'object', properties: { customer: { title: 'nominal.Email', type: 'string', format: 'email', … }, … },
//   required: ['customer', 'quantity'] }
```

[How to get a JSON Schema for a type](../api-docs/json-schema.md) lists the targets.

## Clean a value before the type

ArkType's transforms, which ArkType calls [morphs](../../reference/glossary.md), keep working. To trim an address before it is checked, pipe it into `toArk()`:

```ts
import { type } from 'arktype';
import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
import { Email } from '@horizon-republic/nominal-types';

const Invite = fromArk(type({ email: type('string.trim').pipe(toArk(Email)) }));

Invite.parse({ email: '  jane@example.com ' });
// { ok: true, value: { email: Email { value: 'jane@example.com' } } }
```

## Use the schema in NestJS

Give the schema to `NominalPipe` on the body. This works on Nest 11 and 12:

```ts
// orders.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';
import { CreateOrder, type CreateOrderBody } from './orders';

@Controller('orders')
export class OrdersController {
  @Post()
  create(@Body(new NominalPipe(CreateOrder)) order: CreateOrderBody): string {
    return order.customer.domain; // order.customer is an Email
  }
}
```

A bad body gets status 400: `{ "statusCode": 400, "error": "Bad Request", "message": ["customer: must be an email address (was a string of 4 characters)"] }`.

## Give the object behaviour

Make the object a nominal type with the schema as its rule, and add getters:

```ts
import { type } from 'arktype';
import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
import { Email, Nominal, PositiveInteger } from '@horizon-republic/nominal-types';

class Order extends Nominal(
  'shop.Order',
  fromArk(type({ customer: toArk(Email), quantity: toArk(PositiveInteger) })),
) {
  public get isBulk(): boolean {
    return this.value.quantity.value > 10;
  }
}

const order = new Order({ customer: 'jane@example.com', quantity: 20 });

order.value.customer; // Email
order.isBulk; // true
```

Such a class reads its fields through `value`. A class built on `n.object()` gets a getter for each field instead: see [How to make a value object](../core/make-a-value-object.md). A body that you only take apart needs no class.

## Errors

Each issue has a `message` and a `path`:

| Input                                  | Issue                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| a field the type rejects               | `{ message: 'must be an email address (was a string of 4 characters)', path: ['customer'] }`         |
| a missing field                        | `{ message: 'must be present (was missing)', path: ['customer'] }`                                   |
| not an object at all                   | `{ message: 'must be an object (was a string)' }`                                                    |
| a constraint that fails                | `{ message: 'must not exceed the capacity', path: ['stays', 0, 'guests'] }`                          |
| the class from `Nominal()`, with `new` | throws `NominalError: shop.Order: customer: must be an email address (was a string of 4 characters)` |

## Limits

- A morph after `toArk()`, such as `toArk(Email).pipe(…)`, is not supported. `fromArk()` throws `TypeError: fromArk: a morph holds a nominal type in a form that can't be told apart at runtime; …`. Put that logic into the type instead.
- A union of objects without a literal field can't be told apart. `fromArk()` throws a `TypeError` that starts with `fromArk: a union of objects without a literal field …`. Add a field such as `kind: "'email'"`.
- `constrainArk()` takes only an object type. Anything else throws `TypeError: constrainArk: constraints attach to an ArkType object type`.
- `n.of(Email)` also works inside ArkType without the adapter, but about 20 times slower on a large document: see [Benchmarks](../../reference/benchmarks.md#a-large-document). Use `toArk()`.

## See also

- [ArkType adapter reference](../../reference/adapters/arktype.md): every export, its signature and errors.
- [How to check a request body with n.object()](../core/check-an-object.md)
- [How to use nominal types with NestJS](../frameworks/nestjs.md)
- [How to get a JSON Schema for a type](../api-docs/json-schema.md)

[← Guides](../README.md)
