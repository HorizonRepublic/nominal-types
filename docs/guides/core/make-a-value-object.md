# How to make a value object

This guide shows how to make a type of several fields with its own rules and methods, such as a hotel stay. Such a type is called a [value object](../../reference/glossary.md).

A request body that you check once and take apart doesn't need one. Use a plain [n.object() schema](check-an-object.md) for it.

## Declare the type

Give an `n.object()` schema to `Nominal()`. Add constraints for the rules across fields:

```ts
// stay.ts
import { n, Nominal, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = n.constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => (guests.value <= capacity.value ? true : 'must not exceed the capacity'),
  { path: 'guests' },
);

export class Stay extends Nominal(
  'booking.Stay',
  n.object({ guests: PositiveInteger, capacity: PositiveInteger }, withinCapacity),
) {
  get freePlaces(): number {
    return this.capacity.value - this.guests.value;
  }
}
```

The class gets a getter for each field, such as `this.capacity`. [How to check one field against another](check-fields-together.md) shows how to write constraints.

## Build and check a value

Use `new` for values your code makes, and `parse()` for input from outside:

```ts
// main.ts
import { Stay } from './stay.ts';

const stay = new Stay({ guests: 2, capacity: 3 });

stay.guests; // PositiveInteger { value: 2 }
stay.freePlaces; // 1

new Stay({ guests: 4, capacity: 3 }); // throws NominalError: booking.Stay: guests: must not exceed the capacity
Stay.parse({ guests: 4, capacity: 3 }); // { ok: false, issues: [{ message: 'must not exceed the capacity', path: ['guests'] }] }
```

The object inside is frozen, and TypeScript keeps `value` read-only. So the rules hold after the check. [What keeps the value from changing](../../reference/type-members.md#value) lists the details.

## Change a field

Call `copyWith()` with the fields to change. It returns a new instance, checked like `new`:

```ts
// main.ts
import { Stay } from './stay.ts';

const stay = new Stay({ guests: 2, capacity: 3 });
const fuller = stay.copyWith({ guests: 3 });

fuller.guests.value; // 3
stay.guests.value; // 2, the original is unchanged

stay.copyWith({ guests: 5 }); // throws NominalError: booking.Stay: guests: must not exceed the capacity
```

`copyWith()` takes only the fields the object declares. Another key throws `NominalError` with the issue `is not allowed`.

`copyWith()` builds the copy with `new` on the instance's class. If your class has a constructor of its own, its first argument must be the object of fields:

```ts
// tagged-stay.ts
import { Stay } from './stay.ts';

export class TaggedStay extends Stay {
  readonly tag: string;

  constructor(fields: { guests: number; capacity: number }, tag = 'new') {
    super(fields);
    this.tag = tag;
  }
}

new TaggedStay({ guests: 2, capacity: 3 }, 'vip').copyWith({ guests: 3 }).tag; // 'new'
```

## Compare and send values

Compare with `equals()`. Two instances are different objects, so `===` is `false`:

```ts
// main.ts
import { Stay } from './stay.ts';

const stay = new Stay({ guests: 2, capacity: 3 });

stay.equals(new Stay({ guests: 2, capacity: 3 })); // true
stay === new Stay({ guests: 2, capacity: 3 }); // false
JSON.stringify({ stay }); // '{"stay":{"guests":2,"capacity":3}}'
```

An object type has no single number or string, so `+stay` and `stay > other` throw a `TypeError`. Compare its fields instead: `stay.guests.value`.

## Add a rule in a subtype

Give `subtype()` a constraint. The subtype keeps the methods and the rules of `Stay`:

```ts
// family-stay.ts
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

import { Stay } from './stay.ts';

const forFamilies = n.constraint(
  { capacity: PositiveInteger },
  ({ capacity }) => (capacity.value >= 4 ? true : 'must hold at least 4 people'),
  { path: 'capacity' },
);

export class FamilyStay extends Stay.subtype('booking.FamilyStay', forFamilies) {}

new FamilyStay({ guests: 3, capacity: 4 }).freePlaces; // 1
FamilyStay.parse({ guests: 3, capacity: 3 }); // { ok: false, issues: [{ message: 'must hold at least 4 people', path: ['capacity'] }] }
```

## Avoid reserved field names

Every instance has `value`, `equals`, `copyWith`, `toJSON`, `toString` and `constructor`. A field with one of these names throws a `TypeError` when you declare the type:

```ts
import { n, Nominal, PositiveInteger } from '@horizon-republic/nominal-types';

Nominal('shop.Price', n.object({ value: PositiveInteger }));
// throws TypeError: a type built on n.object() cannot have a field named value: every instance has a member of that name
```

Rename the field, for example to `amount`. A field named `__proto__` throws a `TypeError` in `n.object()` itself.

## See also

- [Type members](../../reference/type-members.md): getters, `copyWith()`, `equals()` and `toJSON()`.
- [Nominal types in domain-driven design](../../explanation/domain-driven-design.md), for when a value object is worth it.

[← Guides](../README.md)
