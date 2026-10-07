# valibot

Entry point: `@horizon-republic/nominal-types/adapters/valibot`. Needs `valibot` 1.

| Export               | Kind     | Use it for                                            |
| -------------------- | -------- | ----------------------------------------------------- |
| `toValibot()`        | function | a field of a Valibot schema that holds a nominal type |
| `constrainValibot()` | function | [constraints](../schemas.md) on a Valibot object      |
| `ValibotField`       | type     | what `toValibot()` returns                            |

## toValibot()

```ts
function toValibot<Target extends AnyNominalType>(target: Target): ValibotField<Target>;
```

| Parameter | Type         | Description                  |
| --------- | ------------ | ---------------------------- |
| `target`  | nominal type | the type the field must hold |

Returns a Valibot schema with `type: 'nominal'`. It takes the type's input and gives an instance.

- Messages are the type's own. For a type that holds an object, the inner path goes into the message: `a: must be a positive integer (was 0)`.
- Use Valibot's `v.array()`, `v.optional()` and `v.nullable()` around it.
- A missing key is reported by Valibot itself: `Invalid key: Expected "email" but received undefined`.
- `v.parse()` throws a `ValiError`; `v.safeParse()` returns the issues.
- The schema is also a Standard Schema on its own.

## constrainValibot()

```ts
function constrainValibot<Schema extends v.BaseSchema<unknown, Record<string, unknown>, v.BaseIssue<unknown>>>(
  object: Schema,
  ...constraints: AnyConstraint[]
): v.SchemaWithPipe<readonly [Schema, v.RawCheckAction<v.InferOutput<Schema>>]>;
```

| Parameter     | Type              | Description               |
| ------------- | ----------------- | ------------------------- |
| `object`      | Valibot object    | the object to check       |
| `constraints` | `AnyConstraint[]` | the constraints to attach |

Returns the object piped into a check. The constraints run once every field of the object is valid, wherever it sits. Issue paths start at the top of the input.

Throws `TypeError: constrainValibot: a constraint reads capacity, which the object does not declare` when a constraint reads a field a `v.object()` or `v.strictObject()` doesn't declare. A `v.looseObject()` keeps undeclared keys and is not checked.

## Example

A request body:

```ts
import * as v from 'valibot';
import { toValibot } from '@horizon-republic/nominal-types/adapters/valibot';
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const CreateOrder = v.object({
  customer: toValibot(Email),
  sku: toValibot(Sku),
  quantity: toValibot(PositiveInteger),
  note: v.optional(v.string()),
});

v.parse(CreateOrder, { customer: 'jane@example.com', sku: 'TEA-0042', quantity: 2 }).customer; // Email

const bad = v.safeParse(CreateOrder, { customer: 'jane', sku: 'TEA-0042', quantity: 0 });
bad.issues?.map((issue) => [v.getDotPath(issue), issue.message]);
// [ ['customer', 'must be an email address (was a string of 4 characters)'],
//   ['quantity', 'must be a positive integer (was 0)'] ]
```

A constraint inside an array:

```ts
import * as v from 'valibot';
import { constrainValibot, toValibot } from '@horizon-republic/nominal-types/adapters/valibot';
import { constraint, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests.value <= capacity.value || 'must not exceed the capacity',
  { path: 'guests' },
);

const Stay = constrainValibot(
  v.object({ guests: toValibot(PositiveInteger), capacity: toValibot(PositiveInteger) }),
  withinCapacity,
);

const result = v.safeParse(v.array(Stay), [{ guests: 4, capacity: 3 }]);
result.issues?.map((issue) => [v.getDotPath(issue), issue.message]);
// [ ['0.guests', 'must not exceed the capacity'] ]
```

## See also

- [How to use nominal types with Valibot](../../guides/validators/valibot.md)
- [Schemas: `constraint()`](../schemas.md)
- [Benchmarks](../benchmarks.md)

[← Adapters](README.md) · [← Reference](../README.md)
