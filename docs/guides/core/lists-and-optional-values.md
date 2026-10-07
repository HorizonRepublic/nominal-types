# How to accept lists, missing values and null

This guide shows how to check a list of values, a value that may be missing and a value that may be `null`.

All three start from `schemaOf(Type)`. It turns a type into a schema you can build on.

## Accept a list

Call `.array()`:

```ts
import { schemaOf, Uuid } from '@horizon-republic/nominal-types';

const Ids = schemaOf(Uuid).array();

Ids.parse(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f']); // { ok: true, value: [Uuid { value: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f' }] }
Ids.parse(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', 'nope']); // { ok: false, issues: [{ message: 'must be a UUID (was "nope")', path: [1] }] }
Ids.parse('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'); // { ok: false, issues: [{ message: 'must be an array (was "0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f")' }] }
```

Every item is checked. Each issue has the item's index in `path`. The result is a new list, read-only by its type.

## Limit the number of items

Pass `min`, `max`, or an exact `length`:

```ts
import { HttpUrl, schemaOf } from '@horizon-republic/nominal-types';

const Photos = schemaOf(HttpUrl).array({ max: 3 });

const urls: unknown = [
  'https://shop.example/1.jpg',
  'https://shop.example/2.jpg',
  'https://shop.example/3.jpg',
  'not a url',
];

Photos.parse(urls); // { ok: false, issues: [{ message: 'must have at most 3 items (was 4)' }] }
schemaOf(HttpUrl).array({ min: 1 }).parse([]); // { ok: false, issues: [{ message: 'must have at least 1 item (was 0)' }] }
schemaOf(HttpUrl).array({ length: 2 }).parse([]); // { ok: false, issues: [{ message: 'must have 2 items (was 0)' }] }
```

The count is checked before the items. Options that don't make sense, such as `length` together with `min`, throw a `TypeError` when you declare the schema.

## Make a list a type of its own

When a list means something in your domain, give it a name with `Nominal()`. The class can have methods:

```ts
import { Nominal, schemaOf, Uuid } from '@horizon-republic/nominal-types';

export class CustomerId extends Uuid.subtype('shop.CustomerId') {}

export class Podium extends Nominal('shop.Podium', schemaOf(CustomerId).array({ length: 3 })) {
  get winner(): CustomerId {
    return this.value[0];
  }
}

const podium = new Podium([
  '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
  '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e60',
  '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e61',
]);

podium.winner; // CustomerId { value: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f' }
new Podium(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f']); // throws NominalError: shop.Podium: must have 3 items (was 1)
```

`new` turns each string into a `CustomerId`. The list inside is frozen.

## Allow a missing value

Call `.optional()`. It lets `undefined` through and checks anything else:

```ts
import { Email, schemaOf } from '@horizon-republic/nominal-types';

const MaybeEmail = schemaOf(Email).optional();

MaybeEmail.parse(undefined); // { ok: true, value: undefined }
MaybeEmail.parse('nope'); // { ok: false, issues: [{ message: 'must be an email address (was a string of 4 characters)' }] }
MaybeEmail.parse(null); // { ok: false, issues: [{ message: 'must be a string (was null)' }] }
```

In an `objectOf()` schema, an optional field may also be left out.

## Allow null

`null` is not a missing value. For `null`, call `.nullable()`:

```ts
import { Email, schemaOf } from '@horizon-republic/nominal-types';

schemaOf(Email).nullable().parse(null); // { ok: true, value: null }
schemaOf(Email).nullable().parse(undefined); // { ok: false, issues: [{ message: 'must be a string (was undefined)' }] }
```

## Combine them

The calls read left to right:

| Schema                                  | Accepts                               |
| --------------------------------------- | ------------------------------------- |
| `schemaOf(Uuid).array().optional()`     | a list of `Uuid`, or `undefined`      |
| `schemaOf(Uuid).optional().array()`     | a list whose items may be `undefined` |
| `schemaOf(Email).optional().nullable()` | an `Email`, `undefined` or `null`     |

## Use them as fields

Put these schemas into `objectOf()`, or pass them to `NominalPipe` in NestJS, like any type:

```ts
import { AnyString, Email, objectOf, schemaOf, Uuid } from '@horizon-republic/nominal-types';

const UpdateProfile = objectOf({
  email: Email,
  nickname: schemaOf(AnyString).optional(),
  backupEmail: schemaOf(Email).nullable(),
  teams: schemaOf(Uuid).array({ max: 10 }),
});

UpdateProfile.parse({ email: 'jane@example.com', backupEmail: null, teams: [] });
// { ok: true, value: { email: Email, backupEmail: null, teams: [] } }
UpdateProfile.parse({ email: 'jane@example.com', teams: [] });
// { ok: false, issues: [{ message: 'must be a string (was undefined)', path: ['backupEmail'] }] }
```

To read list items from text, such as `?ids=1&ids=2`, see [How to read numbers and booleans from text](read-text-values.md).

## See also

- [Schemas](../../reference/schemas.md): `schemaOf()`, `array()`, `optional()`, `nullable()` and their messages.
- [How to check a request body with objectOf()](check-an-object.md)
- [Where checks belong](../../explanation/where-checks-belong.md), for body size limits on your server.

[← Guides](../README.md)
