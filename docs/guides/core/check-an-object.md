# How to check a request body with objectOf()

This guide shows how to check an object, such as a request body or a message, with `objectOf()` and no other library.

This is the way to check bodies in new code. If you already use ArkType, Zod, Valibot or class-validator, see its guide under [Guides](../README.md).

## Write the schema

List the fields and their types:

```ts
// create-order.ts
import { AnyString, Email, objectOf, PositiveInteger, schemaOf } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export const CreateOrder = objectOf({
  customer: Email,
  sku: Sku,
  quantity: PositiveInteger,
  note: schemaOf(AnyString).optional(),
});

export type CreateOrder = ValueOf<typeof CreateOrder>;
```

The last line names the type of a checked object, for functions such as `(order: CreateOrder) => …`.

## Check a body

Call `parse()` with the body:

```ts
// main.ts
import { CreateOrder } from './create-order.ts';

const body: unknown = { customer: 'jane@example.com', sku: 'ABC-1234', quantity: 2 };

const result = CreateOrder.parse(body);

if (result.ok) {
  result.value.sku.value; // 'ABC-1234'
  result.value.quantity.value; // 2
  result.value.note; // undefined, the field is optional
}
```

What you get:

- every field is an instance of its type, such as `Sku` and `PositiveInteger`;
- a new object, read-only by its type; your input is left as it was;
- a missing optional field is left out.

## Read the issues

Every field is checked. Each issue has the field in `path`:

```ts
// main.ts
import { CreateOrder } from './create-order.ts';

const body: unknown = { customer: 'jane', sku: 'abc', quantity: 0 };

CreateOrder.parse(body);
// { ok: false, issues: [
//   { message: 'must be an email address (was a string of 4 characters)', path: ['customer'] },
//   { message: 'must be matched by ^[A-Z]{3}-\d{4}$ (was "abc")', path: ['sku'] },
//   { message: 'must be a positive integer (was 0)', path: ['quantity'] },
// ] }

CreateOrder.parse('hello'); // { ok: false, issues: [{ message: 'must be an object (was "hello")' }] }
```

A missing required field fails its type's first check, such as `must be a string (was undefined)`.

## Refuse keys you didn't declare

By default, keys the schema doesn't list are dropped from the result. To reject them, call `strict()`:

```ts
// main.ts
import { CreateOrder } from './create-order.ts';

const body: unknown = { customer: 'jane@example.com', sku: 'ABC-1234', quantity: 2, admin: true };

CreateOrder.parse(body); // { ok: true, value: { customer: Email, sku: Sku, quantity: PositiveInteger } }
CreateOrder.strict().parse(body); // { ok: false, issues: [{ message: 'is not allowed', path: ['admin'] }] }
```

## Nest objects and lists of objects

A field can be another `objectOf()`, or a list of them with `.array()`:

```ts
import { AnyString, Email, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const PlaceOrder = objectOf({
  customer: Email,
  address: objectOf({ city: AnyString, street: AnyString }),
  items: objectOf({ sku: Sku, quantity: PositiveInteger }).array({ min: 1 }),
});

PlaceOrder.parse({
  customer: 'jane@example.com',
  address: { city: 'Kyiv' },
  items: [{ sku: 'ABC-1234', quantity: 1 }, { sku: 'nope', quantity: 1 }],
});
// { ok: false, issues: [
//   { message: 'must be a string (was undefined)', path: ['address', 'street'] },
//   { message: 'must be matched by ^[A-Z]{3}-\d{4}$ (was "nope")', path: ['items', 1, 'sku'] },
// ] }
```

For lists, missing values and `null`, see [How to accept lists, missing values and null](lists-and-optional-values.md).

## Use a schema from another library for a field

A field can be any Standard Schema that answers at once, such as Zod or ArkType:

```ts
import { Email, objectOf } from '@horizon-republic/nominal-types';
import { type } from 'arktype';
import { z } from 'zod';

const Search = objectOf({
  customer: Email,
  limit: type('1 <= number.integer <= 100'),
  sort: z.enum(['newest', 'oldest']),
});

Search.parse({ customer: 'jane@example.com', limit: 500, sort: 'top' });
// { ok: false, issues: [
//   { message: 'must be at most 100 (was 500)', path: ['limit'] },
//   { message: 'Invalid option: expected one of "newest"|"oldest"', path: ['sort'] },
// ] }
```

## Limits

`objectOf()` has no unions of different object shapes, recursive schemas, transforms or asynchronous checks. For those, use ArkType with its adapter: [How to use nominal types with ArkType](../validators/arktype.md).

## See also

- [Schemas](../../reference/schemas.md): `objectOf()`, `strict()` and `keys`.
- [How to check one field against another](check-fields-together.md)
- [How to use nominal types with NestJS](../frameworks/nestjs.md), for the same schema in a controller.
- [How to get a JSON Schema for a type](../api-docs/json-schema.md), for the same schema in API docs.
- [Where checks belong](../../explanation/where-checks-belong.md)

[← Guides](../README.md)
