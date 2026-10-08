# How to accept one of several object shapes

This guide shows how to check an object that takes one of several shapes, such as a payment by card or by invoice. One field, the tag, tells the shapes apart. Such an object is a [discriminated union](../../reference/glossary.md).

## Write the schema

Give `n.union()` the name of the tag field, and an `n.object()` schema for each tag:

```ts
// payment.ts
import { Email, n, NonBlankString } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';

export const Payment = n.union('method', {
  card: n.object({ token: NonBlankString }),
  invoice: n.object({ email: Email }),
});

export type PaymentBody = ValueOf<typeof Payment>;
```

The variants don't list `method`. The union adds it.

## Check a body

Call `parse()`. The tag picks the variant, and only that variant checks the object:

```ts
// main.ts
import { Payment } from './payment.ts';
import type { PaymentBody } from './payment.ts';

const describe = (payment: PaymentBody): string =>
  payment.method === 'card' ? `card ${payment.token.value}` : `invoice to ${payment.email.value}`;

const body: unknown = { method: 'card', token: 'tok_1' };
const result = Payment.parse(body);

if (result.ok) {
  result.value; // { method: 'card', token: NonBlankString }
  describe(result.value); // 'card tok_1'
}
```

The value keeps the tag. Checking `payment.method` tells TypeScript which variant it holds, so `payment.token` compiles only inside the `'card'` branch.

## Read the issues

A tag that no variant has, or no tag at all, gives one issue under the tag field:

```ts
// main.ts
import { Payment } from './payment.ts';

Payment.parse({ method: 'cash' });
// { ok: false, issues: [{ message: 'must be one of "card", "invoice" (was "cash")', path: ['method'] }] }
Payment.parse({ token: 'tok_1' });
// { ok: false, issues: [{ message: 'must be one of "card", "invoice" (was undefined)', path: ['method'] }] }
```

With a known tag, the issues are those of the variant:

```ts
// main.ts
import { Payment } from './payment.ts';

Payment.parse({ method: 'invoice', email: 'jane' });
// { ok: false, issues: [{ message: 'must be an email address (was a string of 4 characters)', path: ['email'] }] }
```

Tags are strings, compared exactly: `'Card'` is not `'card'`.

## Use it in other schemas

The union works as a field of `n.object()`, in a list, and as the rule of a [value object](make-a-value-object.md):

```ts
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

import { Payment } from './payment.ts';

const PlaceOrder = n.object({ quantity: PositiveInteger, payment: Payment });

PlaceOrder.parse({ quantity: 1, payment: { method: 'cash' } });
// { ok: false, issues: [{ message: 'must be one of "card", "invoice" (was "cash")', path: ['payment', 'method'] }] }

Payment.array({ max: 3 }).parse([{ method: 'card', token: '' }]);
// { ok: false, issues: [{ message: 'must be a non-empty string (was "")', path: [0, 'token'] }] }
```

Each variant keeps its own `strict()`, `partial()` and constraints.

## Describe it in API docs

The JSON Schema is a `oneOf` of the variants. In each one, the tag field is a constant and required. For OpenAPI 3.0, the schema also names the tag field as the `discriminator`:

```ts
import { Payment } from './payment.ts';

Payment['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { oneOf: [
//   { type: 'object', properties: { method: { type: 'string', enum: ['card'] }, token: { … } }, required: ['method', 'token'] },
//   { type: 'object', properties: { method: { type: 'string', enum: ['invoice'] }, email: { … } }, required: ['method', 'email'] },
// ], discriminator: { propertyName: 'method' } }
```

## Limits

- Every variant is an `n.object()` schema. `n.union()` throws a `TypeError` for anything else.
- The shapes must differ by a tag field. For shapes told apart some other way, use ArkType with its adapter: [How to use nominal types with ArkType](../validators/arktype.md).

## See also

- [Schemas](../../reference/schemas.md#nunion): `n.union()` and `UnionSchema`.
- [How to check a request body with n.object()](check-an-object.md)
- [How to get a JSON Schema for a type](../api-docs/json-schema.md)

[← Guides](../README.md)
