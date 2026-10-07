# How to use nominal types in ArkType schemas

> This is the recommended way to check objects. For the other ways and when they fit, see [Choosing how to check input](../explanation/choosing-an-approach.md).

This guide shows how to check a request body, a message or a config with [ArkType](https://arktype.io) and get nominal instances back, such as an `Email`, at ArkType's own speed.

The helpers come from a separate entry point, `@horizon-republic/nominal-types/adapters/arktype`. You only need `arktype` if you import it. It works with ArkType 2.2 and later.

The adapter has three functions, one for each level:

| Function                    | Wraps                                                                    |
| --------------------------- | ------------------------------------------------------------------------ |
| `arkOf(Type)`               | a field: a nominal type as an ArkType node                               |
| `arkObject(type, ...rules)` | an object, with [constraints](checking-fields-together.md) on its fields |
| `arkSchema(type, ...rules)` | the whole schema: checks, builds instances, runs the constraints         |

## Writing a schema

Put `arkOf(Type)` where a field holds a nominal type, then wrap the whole schema in `arkSchema()`:

```ts
import { type } from 'arktype';
import { arkOf, arkSchema } from '@horizon-republic/nominal-types/adapters/arktype';
import { Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

export const CreateOrder = arkSchema(
  type({
    customerId: arkOf(Uuid),
    email: arkOf(Email),
    items: type({ sku: 'string', quantity: arkOf(PositiveInteger) }).array(),
    'note?': 'string',
  }),
);

const result = CreateOrder.parse(body);

if (result.ok) {
  result.value.email; // Email
  result.value.items[0]?.quantity; // PositiveInteger
} else {
  result.issues; // [{ message: 'must be an email address (was "nope")', path: ['email'] }]
}
```

`arkSchema()` checks the input with ArkType first. Then it builds an instance for every `arkOf()` field, in one pass.

The messages are the type's own, the same as `Email.parse()` gives.

## Naming a schema and its type

Give the schema and the type of its value one name, as ArkType itself suggests. Signatures then read like a class:

```ts
import type { ValueOf } from '@horizon-republic/nominal-types';

export const CreateOrder = arkSchema(type({ email: arkOf(Email), quantity: arkOf(PositiveInteger) }));
export type CreateOrder = ValueOf<typeof CreateOrder>;

const place = (order: CreateOrder): void => {
  order.email; // Email
};
```

## Optional values, null, lists and unions

Use ArkType's own syntax around `arkOf()`:

| You want                   | Write                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------- |
| an optional field          | `'backup?': arkOf(Email)`                                                           |
| a value or `null`          | `arkOf(Email).or('null')`                                                           |
| a list                     | `arkOf(Uuid).array()`, with `.atLeastLength(1)`                                     |
| a tuple                    | `[arkOf(Uuid), arkOf(PositiveInteger)]`                                             |
| a record                   | `type({ '[string]': arkOf(Email) })`                                                |
| one type or another        | `arkOf(Email).or(arkOf(Uuid))`                                                      |
| objects of different kinds | `type({ kind: "'email'", to: arkOf(Email) }).or({ kind: "'id'", to: arkOf(Uuid) })` |

In a union, each branch must be told apart by its type or by a literal field such as `kind`. `arkSchema()` throws a `TypeError` when it can't tell which branch a value took, for example two object branches without a literal field.

## Cleaning a value before the type

ArkType morphs keep working. To trim an address before it's checked, pipe into `arkOf()`:

```ts
const Invite = arkSchema(type({ email: type('string.trim').pipe(arkOf(Email)) }));

Invite.parse({ email: '  jane@example.com ' }); // email: Email('jane@example.com')
```

A morph after `arkOf()` is not supported: `arkSchema()` throws a `TypeError`. Put the logic into the type instead.

## Checking one field against another

Attach [constraints](checking-fields-together.md) to an ArkType object with `arkObject()`. They run on that object wherever it sits, after the instances are built:

```ts
import { arkObject } from '@horizon-republic/nominal-types/adapters/arktype';
import { constraint } from '@horizon-republic/nominal-types';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

const Stay = arkObject(
  type({ guests: arkOf(PositiveInteger), capacity: arkOf(PositiveInteger) }),
  withinCapacity,
);

const CreateBooking = arkSchema(type({ hotel: 'string', stays: Stay.array() }));

CreateBooking.parse({ hotel: 'Lviv', stays: [{ guests: 4, capacity: 3 }] });
// issues: [{ message: 'must not exceed the capacity', path: ['stays', 0, 'guests'] }]
```

For the top object, pass constraints straight to `arkSchema()`: `arkSchema(type({ … }), withinCapacity)`.

Constraints run only when ArkType has accepted the whole input.

## Making a class of a schema

When an object is a value with behaviour of its own, make it a nominal type with the schema as its rule:

```ts
import { Nominal } from '@horizon-republic/nominal-types';

export class Order extends Nominal(
  'Order',
  arkSchema(type({ email: arkOf(Email), quantity: arkOf(PositiveInteger) })),
) {
  public get isBulk(): boolean {
    return this.value.quantity.value > 10;
  }
}

const order = new Order({ email: 'jane@example.com', quantity: 20 });

order.value.email; // Email
order.isBulk; // true
```

The value is frozen and read through `value`. For a request body that is only taken apart, the plain object from `arkSchema()` is simpler.

## Using the schema elsewhere

The result of `arkSchema()` is a Standard Schema. Anything that reads Standard Schema takes it, such as NestJS 12 with its `StandardSchemaValidationPipe`:

```ts
import { Body, Controller, Post, StandardSchemaValidationPipe } from '@nestjs/common';
app.useGlobalPipes(new StandardSchemaValidationPipe());

@Controller('orders')
export class OrdersController {
  @Post()
  public create(@Body({ schema: CreateOrder }) order: CreateOrder): void {
    order.email; // Email
  }
}
```

It also describes itself as JSON Schema, with each `arkOf()` field described by its type: pattern, format, limits and example. The targets are `draft-2020-12`, `draft-07` and `openapi-3.0`:

```ts
CreateOrder['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
```

The ArkType type itself stays in `CreateOrder.ark`. Called on its own, it checks the input but returns plain values and runs no constraints.

## Without the adapter

`schemaOf(Type)` also works inside ArkType, as in [How to use a type inside another validator](other-validators.md). ArkType runs such a field through a slower path. On a 3 MB document, the adapter checks and builds everything in about 4.5 ms instead of about 110 ms. See [Performance](../explanation/performance.md#a-large-document).

[← Guides](README.md)
