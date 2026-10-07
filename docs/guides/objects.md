# How to check an object with objectOf()

This guide shows how to check a request body, a message or a config with nominal types and no other validation library, and how to make a value object of several fields.

## Writing a schema

List the fields and their types:

```ts
import { AnyString, Email, objectOf, PositiveInteger, schemaOf } from '@horizon-republic/nominal-types';

export const CreateOrder = objectOf({
  email: Email,
  quantity: PositiveInteger,
  note: schemaOf(AnyString).optional(),
});

const result = CreateOrder.parse(body);

if (result.ok) {
  result.value.email; // Email
  result.value.quantity; // PositiveInteger
} else {
  result.issues; // [{ message: 'must be an email address (was "nope")', path: ['email'] }]
}
```

A field can be:

| Field                         | Example                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| a nominal type                | `email: Email`                                                                                              |
| a list, optional or nullable  | `tags: schemaOf(Tag).array()`, `note: schemaOf(AnyString).optional()`, `backup: schemaOf(Email).nullable()` |
| another object                | `address: objectOf({ city: AnyString })`                                                                    |
| a list of objects             | `items: objectOf({ sku: Sku }).array({ min: 1 })`                                                           |
| a schema from another library | `limit: type('number > 0')`                                                                                 |

Every field is checked, and every issue is reported with its path, such as `['items', 0, 'sku']`.

A field whose schema accepts `undefined`, such as `.optional()`, may be missing. It is left out of the result when it is.

The result is a new object, read-only by its type. Your input is left as it was.

## Keys you didn't declare

Keys the schema doesn't list are dropped from the result, so nothing unchecked reaches your code. To refuse them instead, call `strict()`:

```ts
CreateOrder.strict().parse({ email: 'jane@example.com', quantity: 1, admin: true });
// issues: [{ message: 'is not allowed', path: ['admin'] }]
```

## Checking fields against each other

Pass [constraints](checking-fields-together.md) after the fields. They run once every field is valid:

```ts
import { constraint, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

export const Booking = objectOf(
  { guests: PositiveInteger, capacity: PositiveInteger },
  withinCapacity,
);
```

## Making a value object

Give the schema to `Nominal()`. The class gets a getter for each field and `copyWith()`:

```ts
import { Nominal } from '@horizon-republic/nominal-types';

export class Stay extends Nominal(
  'booking.Stay',
  objectOf({ guests: PositiveInteger, capacity: PositiveInteger }, withinCapacity),
) {
  public get free(): number {
    return this.capacity.value - this.guests.value;
  }
}

const stay = new Stay({ guests: 2, capacity: 3 });

stay.guests; // PositiveInteger
stay.free; // 1

const fuller = stay.copyWith({ guests: 3 }); // a new Stay; stay is unchanged
stay.copyWith({ guests: 5 }); // throws NominalError: booking.Stay: guests: must not exceed the capacity
```

- The value of the class is frozen.
- `copyWith()` returns a new instance with the given fields changed and checks it like `new`.
- A field can't be named `value`, `equals`, `copyWith`, `toJSON`, `toString` or `constructor`, since every instance has those. `Nominal()` throws a `TypeError` for such a field.

## Using it in NestJS

The schema is a Standard Schema, so `NominalPipe` and NestJS 12's `{ schema }` both take it:

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';
import type { ValueOf } from '@horizon-republic/nominal-types';

export type CreateOrder = ValueOf<typeof CreateOrder>;

@Controller('orders')
export class OrdersController {
  @Post()
  public create(@Body(new NominalPipe(CreateOrder)) order: CreateOrder): void {
    order.email; // Email
  }
}
```

It also describes itself as JSON Schema, with each field described by its type.

## Where it stops

`objectOf()` covers objects, lists, optional and nullable values and rules across fields. It has no unions of different object shapes, recursive schemas, transforms or asynchronous checks. For those, use ArkType with the [adapter](arktype.md).

[← Guides](README.md)
