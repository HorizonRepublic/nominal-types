# How to validate arrays and optional values

This guide shows how to check a list of values, a value that may be missing, and a value that may be `null`. All three start from `schemaOf()`.

## Getting a schema for a type

`schemaOf(Type)` turns a nominal type into a plain schema object. You build the rest from it:

```ts
import { Email, schemaOf, Uuid } from '@horizon-republic/nominal-types';

schemaOf(Uuid).array(); // a list of Uuid
schemaOf(Email).optional(); // an Email or undefined
schemaOf(Email).nullable(); // an Email or null
```

Each schema has `parse()`, which works like `Type.parse()`:

```ts
schemaOf(Uuid).array().parse(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', 'nope']);
// { ok: false, issues: [{ message: 'must be a UUID (was "nope")', path: [1] }] }
```

The same schema object also goes to [NestJS](nestjs.md) and into [ArkType](other-validators.md). To read values from text first, add [`fromString()`](reading-strings.md).

## Validating an array

Call `.array()`:

```ts
const result = schemaOf(Uuid).array().parse(input);

if (result.ok) {
  result.value; // readonly Uuid[]
}
```

What you get:

- every item is checked, and each issue has the item's index in `path`;
- the result is a frozen array, so nobody can add an invalid item later.

## Limiting the number of items

Pass `length`, or `min` and `max`:

```ts
schemaOf(Url).array({ max: 10 }); // up to ten
schemaOf(Url).array({ min: 1 }); // at least one
schemaOf(UserId).array({ length: 3 }); // exactly three
```

The count is checked first. A list that is too long is rejected before any item is checked:

```ts
schemaOf(Url).array({ max: 10 }).parse(elevenUrls);
// { ok: false, issues: [{ message: 'must have at most 10 items (was 11)' }] }
```

## Making a list a type of its own

If a list means something in your domain, give it a name. Pass the array schema to `Nominal()`:

```ts
import { Nominal, schemaOf, Uuid } from '@horizon-republic/nominal-types';

export class UserId extends Uuid.subtype('UserId') {}

export class Podium extends Nominal('Podium', schemaOf(UserId).array({ length: 3 })) {
  get winner(): UserId {
    return this.value[0];
  }
}

const podium = new Podium(['…', '…', '…']);

podium.winner; // a UserId
```

This is the recommended way: the rule has a name, it shows in signatures such as `(podium: Podium)`, and the list can have methods. For a simple field, like "up to ten photos", the inline `array({ max: 10 })` is fine too.

## Allowing a missing value

Call `.optional()`. It lets `undefined` through and checks anything else:

```ts
schemaOf(Email).optional().parse(undefined); // { ok: true, value: undefined }
schemaOf(Email).optional().parse('nope'); // { ok: false, … }
```

`null` is not a missing value. For `null`, use `.nullable()`:

```ts
schemaOf(Email).nullable().parse(null); // { ok: true, value: null }
```

## Combining them

Calls read left to right:

| Schema                                  | Accepts                               |
| --------------------------------------- | ------------------------------------- |
| `schemaOf(Uuid).array().optional()`     | a list of `Uuid`, or `undefined`      |
| `schemaOf(Uuid).optional().array()`     | a list where items may be `undefined` |
| `schemaOf(Email).optional().nullable()` | an `Email`, `undefined` or `null`     |

## Where size limits belong

`array({ max })` limits one field. It doesn't replace the limits of your server, which stop huge requests before any code runs:

- Fastify limits the body to 1 MB by default (`bodyLimit`);
- Express limits the body with `express.json({ limit })`;
- Node.js limits the URL and headers to 16 KB.

[← Guides](README.md)
