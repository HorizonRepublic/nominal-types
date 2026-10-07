# How to use nominal types in Zod schemas

> Recommended when the project already uses Zod. Otherwise, see [Choosing how to check input](../explanation/choosing-an-approach.md).

This guide shows how to put nominal types into [Zod](https://zod.dev) 4 schemas and get instances back, such as an `Email`.

The helpers come from a separate entry point, `@horizon-republic/nominal-types/adapters/zod`. You only need `zod` if you import it.

| Function                         | Does                                                                |
| -------------------------------- | ------------------------------------------------------------------- |
| `toZod(Type)`                    | turns a nominal type into a Zod schema for a field                  |
| `constrainZod(object, ...rules)` | attaches [constraints](checking-fields-together.md) to a Zod object |

## Writing a schema

```ts
import { z } from 'zod';
import { toZod } from '@horizon-republic/nominal-types/adapters/zod';
import { Email, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

export const CreateOrder = z.object({
  customerId: toZod(Uuid),
  email: toZod(Email),
  quantity: toZod(PositiveInteger),
  note: z.string().optional(),
});

const order = CreateOrder.parse(body);

order.email; // Email
```

The field checks the value with the type's own rules and messages, and gives the instance. Use Zod's own `z.array()`, `.optional()` and `.nullable()` around it.

## Checking fields against each other

```ts
import { constrainZod } from '@horizon-republic/nominal-types/adapters/zod';

const Stay = constrainZod(
  z.object({ guests: toZod(PositiveInteger), capacity: toZod(PositiveInteger) }),
  withinCapacity,
);
```

The constraints run once every field of the object is valid, wherever the object sits: at the top or in an array.

## JSON Schema

Each `toZod()` field carries its type's schema, so the input side is described in full:

```ts
z.toJSONSchema(CreateOrder, { io: 'input' });
// { properties: { email: { title: 'nominal.Email', format: 'email', pattern: … }, … } }
```

The output side holds instances, which JSON Schema can't describe; Zod throws for it. Ask for `io: 'input'`.

## Speed

On a 3 MB document, the Zod adapter takes about 9 ms where Zod alone takes about 7 ms; the difference is the 112,000 instances it builds. See [Performance](../explanation/performance.md#a-large-document).

[← Guides](README.md)
