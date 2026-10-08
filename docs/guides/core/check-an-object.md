# How to check a request body with n.object()

This guide shows how to check an object, such as a request body or a message, with `n.object()` and no other library.

This is the way to check bodies in new code. If you already use ArkType, Zod, Valibot or class-validator, see its guide under [Guides](../README.md).

## Write the schema

List the fields and their types:

```ts
// create-order.ts
import { AnyString, Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export const CreateOrder = n.object({
  customer: Email,
  sku: Sku,
  quantity: PositiveInteger,
  note: n.of(AnyString).optional(),
});

export type CreateOrderBody = ValueOf<typeof CreateOrder>;
```

The last line names the type of a checked object, for functions such as `(order: CreateOrderBody) => …`. Give the type a name of its own. In NestJS, a type named like the schema breaks Swagger and pipes under Bun and SWC; see [Limits in the NestJS guide](../frameworks/nestjs.md#limits).

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

A missing required field gets the issue `is required`. So does a field that holds `undefined`.

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

A field can be another `n.object()`, or a list of them with `.array()`:

```ts
import { AnyString, Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const PlaceOrder = n.object({
  customer: Email,
  address: n.object({ city: AnyString, street: AnyString }),
  items: n.object({ sku: Sku, quantity: PositiveInteger }).array({ min: 1 }),
});

PlaceOrder.parse({
  customer: 'jane@example.com',
  address: { city: 'Kyiv' },
  items: [{ sku: 'ABC-1234', quantity: 1 }, { sku: 'nope', quantity: 1 }],
});
// { ok: false, issues: [
//   { message: 'is required', path: ['address', 'street'] },
//   { message: 'must be matched by ^[A-Z]{3}-\d{4}$ (was "nope")', path: ['items', 1, 'sku'] },
// ] }
```

For lists, missing values and `null`, see [How to accept lists, missing values and null](lists-and-optional-values.md).

## Use a schema from another library for a field

A field can be any Standard Schema that answers at once, such as Zod or ArkType:

```ts
import { Email, n } from '@horizon-republic/nominal-types';
import { type } from 'arktype';
import { z } from 'zod';

const Search = n.object({
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

`n.object()` has no unions of different object shapes, recursive schemas, transforms or asynchronous checks. For those, use ArkType with its adapter: [How to use nominal types with ArkType](../validators/arktype.md).

## See also

- [Schemas](../../reference/schemas.md): `n.object()`, `strict()` and `keys`.
- [How to check one field against another](check-fields-together.md)
- [How to use nominal types with NestJS](../frameworks/nestjs.md), for the same schema in a controller.
- [How to get a JSON Schema for a type](../api-docs/json-schema.md), for the same schema in API docs.
- [Where checks belong](../../explanation/where-checks-belong.md)

[← Guides](../README.md)
