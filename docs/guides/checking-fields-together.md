# How to check one field against another

This guide shows how to check a rule that reads more than one field, such as "the number of guests must not exceed the capacity of the room". A type checks one value, so it can't see the other field. A constraint can.

It works like a `CHECK` constraint over several columns in SQL.

## Writing a constraint

List the fields the rule reads, with their types, then write the check:

```ts
import { constraint, PositiveInteger } from '@horizon-republic/nominal-types';

export const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);
```

The check gets `guests` and `capacity` as `PositiveInteger` instances. Instances compare by their values, so `guests <= capacity` compares the numbers.

The check returns:

| Return   | Means                                                                   |
| -------- | ----------------------------------------------------------------------- |
| `true`   | the fields agree                                                        |
| `false`  | they don't; the message is `message` from the options, or a default one |
| a string | they don't, and the string is the message                               |

`path` says which field the message belongs to. Leave it out when the message is about the whole object.

## What happens when a field is invalid

The constraint checks each listed field first. If a field is invalid, you get that field's own message, and the check doesn't run:

```ts
withinCapacity['~standard'].validate({ guests: 0, capacity: 3 });
// { issues: [{ message: 'must be a positive integer (was 0)', path: ['guests'] }] }

withinCapacity['~standard'].validate({ guests: 4, capacity: 3 });
// { issues: [{ message: 'must not exceed the capacity', path: ['guests'] }] }
```

So the check never has to handle a missing or wrong field.

## Making a type of the object

A constraint can be the rule of a type. The instance then holds an object with instances inside:

```ts
import { Nominal } from '@horizon-republic/nominal-types';

export class Occupancy extends Nominal('Occupancy', withinCapacity) {}

const occupancy = new Occupancy({ guests: 2, capacity: 3 });

occupancy.value.guests; // PositiveInteger
String(occupancy); // '{"guests":2,"capacity":3}'

new Occupancy({ guests: 4, capacity: 3 });
// NominalError: Occupancy: guests: must not exceed the capacity
```

The value is frozen, so nobody can break the rule after the check. Your input object is copied, not frozen.

In NestJS, give the type to `NominalPipe` like any other type:

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

@Controller('bookings')
export class BookingsController {
  @Post()
  public create(@Body(new NominalPipe(Occupancy)) occupancy: Occupancy): void {
    // a body with 4 guests for 3 places gets 400 with 'guests: must not exceed the capacity'
  }
}
```

## Reading other kinds of fields

A field can also be a list or an optional value, through `schemaOf()`, or any schema from another library:

```ts
import { type } from 'arktype';
import { constraint, PositiveInteger, schemaOf } from '@horizon-republic/nominal-types';

export const withinBudget = constraint(
  { prices: schemaOf(PositiveInteger).array(), budget: type('number') },
  ({ prices, budget }) =>
    prices.reduce((sum, price) => sum + price.value, 0) <= budget || 'over budget',
  { path: 'prices' },
);
```

Fields you don't list pass through without a check.

[← Guides](README.md)
