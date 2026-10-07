# zod

Entry point: `@horizon-republic/nominal-types/adapters/zod`. Needs `zod` 4.

| Export           | Kind     | Use it for                                        |
| ---------------- | -------- | ------------------------------------------------- |
| `toZod()`        | function | a field of a Zod schema that holds a nominal type |
| `constrainZod()` | function | [constraints](../schemas.md) on a Zod object      |
| `ZodField`       | type     | what `toZod()` returns                            |

## toZod()

```ts
function toZod<Target extends AnyNominalType>(target: Target): ZodField<Target>;
```

| Parameter | Type         | Description                  |
| --------- | ------------ | ---------------------------- |
| `target`  | nominal type | the type the field must hold |

Returns a Zod schema. It takes the type's input and gives an instance. An instance passed in comes out as it is.

- Messages are the type's own. Each issue has `code: 'custom'`.
- Use Zod's `z.array()`, `.optional()` and `.nullable()` around it.
- Zod's `parse()` throws a `ZodError`; `safeParse()` returns the issues.

### JSON Schema

The field carries its type's JSON Schema: pattern, format and limits. Ask for the input side: `z.toJSONSchema(schema, { io: 'input' })`.

The output side holds instances. `z.toJSONSchema(schema)` without `io: 'input'` throws `Error: Transforms cannot be represented in JSON Schema`.

## constrainZod()

```ts
function constrainZod<Shape extends z.ZodObject>(object: Shape, ...constraints: AnyConstraint[]): Shape;
```

| Parameter     | Type              | Description               |
| ------------- | ----------------- | ------------------------- |
| `object`      | Zod object        | the object to check       |
| `constraints` | `AnyConstraint[]` | the constraints to attach |

Returns the object with the constraints attached. They run once every field of the object is valid, wherever it sits: at the top or in an array. Each issue has `code: 'custom'` and a path from the top of the input.

Throws `TypeError: constrainZod: a constraint reads capacity, which the object does not declare` when a constraint reads a field the object doesn't declare. A loose object, from `z.looseObject()`, keeps undeclared keys and is not checked.

## Example

A request body:

```ts
import { z } from 'zod';
import { toZod } from '@horizon-republic/nominal-types/adapters/zod';
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const CreateOrder = z.object({
  customer: toZod(Email),
  sku: toZod(Sku),
  quantity: toZod(PositiveInteger),
  note: z.string().optional(),
});

CreateOrder.parse({ customer: 'jane@example.com', sku: 'TEA-0042', quantity: 2 }).customer; // Email

CreateOrder.safeParse({ customer: 'jane', sku: 'TEA-0042', quantity: 0 }).error?.issues;
// [ { code: 'custom', message: 'must be an email address (was a string of 4 characters)', path: ['customer'] },
//   { code: 'custom', message: 'must be a positive integer (was 0)', path: ['quantity'] } ]
```

A constraint inside an array:

```ts
import { z } from 'zod';
import { constrainZod, toZod } from '@horizon-republic/nominal-types/adapters/zod';
import { constraint, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests.value <= capacity.value || 'must not exceed the capacity',
  { path: 'guests' },
);

const Stay = constrainZod(
  z.object({ guests: toZod(PositiveInteger), capacity: toZod(PositiveInteger) }),
  withinCapacity,
);

z.array(Stay).safeParse([{ guests: 4, capacity: 3 }]).error?.issues;
// [ { code: 'custom', message: 'must not exceed the capacity', path: [0, 'guests'] } ]
```

## See also

- [How to use nominal types with Zod](../../guides/validators/zod.md)
- [Schemas: `constraint()`](../schemas.md)
- [Benchmarks](../benchmarks.md)

[← Adapters](README.md) · [← Reference](../README.md)
