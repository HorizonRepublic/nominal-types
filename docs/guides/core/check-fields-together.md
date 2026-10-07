# How to check one field against another

This guide shows how to check a rule that reads several fields, such as "the guests must fit the room".

A type checks one value. A [constraint](../../reference/glossary.md) reads several fields of an object.

## Write a constraint

List the fields the rule reads, with their types. Then write the check:

```ts
import { constraint, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => (guests.value <= capacity.value ? true : 'must not exceed the capacity'),
  { path: 'guests' },
);

const BookRoom = objectOf({ guests: PositiveInteger, capacity: PositiveInteger }, withinCapacity);

BookRoom.parse({ guests: 2, capacity: 3 }); // { ok: true, value: { guests: PositiveInteger, capacity: PositiveInteger } }
BookRoom.parse({ guests: 4, capacity: 3 }); // { ok: false, issues: [{ message: 'must not exceed the capacity', path: ['guests'] }] }
```

The check gets each field as an instance of its type. Pass constraints to `objectOf()` after the fields.

Every field a constraint reads must also be a field of the object. Otherwise `objectOf()` throws a `TypeError` when you declare it: `objectOf: a constraint reads capacity, which the object does not declare`.

The check returns:

| Return   | Means                                                                       |
| -------- | --------------------------------------------------------------------------- |
| `true`   | the fields agree                                                            |
| a string | they don't, and the string is the message                                   |
| `false`  | they don't, and the message is `message` from the options, or a default one |

## Choose where the message goes

`path` names the field the issue belongs to. Without `path`, the issue belongs to the whole object:

```ts
import { constraint, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

const fields = { guests: PositiveInteger, capacity: PositiveInteger };

const onGuests = constraint(fields, ({ guests, capacity }) => guests.value <= capacity.value, {
  path: 'guests',
  message: 'too many guests',
});
const onObject = constraint(fields, ({ guests, capacity }) => guests.value <= capacity.value);

objectOf(fields, onGuests).parse({ guests: 4, capacity: 3 }); // { ok: false, issues: [{ message: 'too many guests', path: ['guests'] }] }
objectOf(fields, onObject).parse({ guests: 4, capacity: 3 }); // { ok: false, issues: [{ message: 'guests, capacity must agree' }] }
```

## Know when the check runs

The check runs only when every field is valid. An invalid field gets its own message, and the check is skipped:

```ts
import { constraint, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => (guests.value <= capacity.value ? true : 'must not exceed the capacity'),
  { path: 'guests' },
);

const BookRoom = objectOf({ guests: PositiveInteger, capacity: PositiveInteger }, withinCapacity);

BookRoom.parse({ guests: 0, capacity: 3 }); // { ok: false, issues: [{ message: 'must be a positive integer (was 0)', path: ['guests'] }] }
```

So the check never handles a missing or wrong field.

## Add several constraints

Pass them one after another. Each one that fails adds its issue:

```ts
import { constraint, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => (guests.value <= capacity.value ? true : 'must not exceed the capacity'),
  { path: 'guests' },
);
const adultsAmongGuests = constraint(
  { guests: PositiveInteger, adults: PositiveInteger },
  ({ guests, adults }) => (adults.value <= guests.value ? true : 'must not exceed the guests'),
  { path: 'adults' },
);

const BookRoom = objectOf(
  { guests: PositiveInteger, adults: PositiveInteger, capacity: PositiveInteger },
  withinCapacity,
  adultsAmongGuests,
);

BookRoom.parse({ guests: 4, adults: 5, capacity: 3 });
// { ok: false, issues: [
//   { message: 'must not exceed the capacity', path: ['guests'] },
//   { message: 'must not exceed the guests', path: ['adults'] },
// ] }
```

## Read a list or a field of another library

A field of a constraint can be a `schemaOf()` schema or a schema from another library:

```ts
import { constraint, objectOf, PositiveInteger, schemaOf } from '@horizon-republic/nominal-types';
import { z } from 'zod';

const fields = { prices: schemaOf(PositiveInteger).array(), budget: z.number() };

const withinBudget = constraint(
  fields,
  ({ prices, budget }) =>
    prices.reduce((sum, price) => sum + price.value, 0) <= budget ? true : 'must not exceed the budget',
  { path: 'prices' },
);

const Basket = objectOf(fields, withinBudget);

Basket.parse({ prices: [30, 80], budget: 100 }); // { ok: false, issues: [{ message: 'must not exceed the budget', path: ['prices'] }] }
```

## Use a constraint elsewhere

- To keep the rule inside a type with methods, see [How to make a value object](make-a-value-object.md).
- To use it in ArkType, Zod or Valibot, see the `constrain…()` function in [ArkType](../validators/arktype.md), [Zod](../validators/zod.md) or [Valibot](../validators/valibot.md). `constrainZod()` and `constrainValibot()` throw the same `TypeError` for a field the object doesn't declare.

## See also

- [Schemas](../../reference/schemas.md): `constraint()` and its options.
- [How to check a request body with objectOf()](check-an-object.md)

[← Guides](../README.md)
