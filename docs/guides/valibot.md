# How to use nominal types in Valibot schemas

> Recommended when the project already uses Valibot. Otherwise, see [Choosing how to check input](../explanation/choosing-an-approach.md).

This guide shows how to put nominal types into [Valibot](https://valibot.dev) schemas and get instances back, such as an `Email`.

The helpers come from a separate entry point, `@horizon-republic/nominal-types/adapters/valibot`. You only need `valibot` if you import it.

| Function                             | Does                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `toValibot(Type)`                    | turns a nominal type into a Valibot schema for a field                  |
| `constrainValibot(object, ...rules)` | attaches [constraints](checking-fields-together.md) to a Valibot object |

## Writing a schema

```ts
import * as v from 'valibot';
import { toValibot } from '@horizon-republic/nominal-types/adapters/valibot';
import { Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

export const CreateOrder = v.object({
  customerId: toValibot(Uuid),
  email: toValibot(Email),
  quantity: toValibot(PositiveInteger),
  note: v.optional(v.string()),
});

const order = v.parse(CreateOrder, body);

order.email; // Email
```

The field checks the value with the type's own rules and messages, and gives the instance. Use Valibot's own `v.array()`, `v.optional()` and `v.nullable()` around it. A missing key is reported by Valibot itself: `Invalid key: Expected "email" but received undefined`.

## Checking fields against each other

```ts
import { constrainValibot } from '@horizon-republic/nominal-types/adapters/valibot';

const Stay = constrainValibot(
  v.object({ guests: toValibot(PositiveInteger), capacity: toValibot(PositiveInteger) }),
  withinCapacity,
);
```

The constraints run once every field of the object is valid, wherever the object sits.

## Speed

On a 3 MB document, the Valibot adapter takes about 12 ms where Valibot alone takes about 7.5 ms; the difference is the 112,000 instances it builds and the extra work they give the garbage collector. See [Performance](../explanation/performance.md#a-large-document).

[← Guides](README.md)
