# How to generate JSON Schema

This guide shows how to get a JSON Schema for a type. You can use it in OpenAPI documents, form generators or validators in other languages.

## Getting a type's schema

Call `['~standard'].jsonSchema.input()` and name the format you need:

```ts
import { Uuid } from '@horizon-republic/nominal-types';

Uuid['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { type: 'string', pattern: '^(?:[\\dA-Fa-f]{8}-…)$', description: 'a UUID' }
```

| `target`        | Use it for                             |
| --------------- | -------------------------------------- |
| `openapi-3.0`   | OpenAPI 3.0 documents                  |
| `draft-2020-12` | current JSON Schema tools, OpenAPI 3.1 |
| `draft-07`      | older JSON Schema tools                |

There is also `output()`, for the shape a response carries. For the built-in types it gives the same result as `input()`.

A type with several rules gets an `allOf`, one entry per rule:

```ts
PositiveInteger['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { allOf: [{ type: 'number', … }, …, { type: 'integer', minimum: 1, … }] }
```

## Making the schema more useful

Every type's schema has its name as `title`. The built-in types also add a `format`, length limits and an example, so Swagger UI and similar tools show a real value instead of `"string"`.

Give your own types the same with the third argument of `matching()` or `satisfying()`:

```ts
import { AnyString, matching } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype(
  'Sku',
  matching(/^SKU-\d{4}$/u, 'a SKU', { minLength: 8, maxLength: 8, examples: ['SKU-0042'] }),
) {}
```

Keep the extra keywords true to the rule: a length limit must match what the pattern allows.

Examples are checked for you. A type shows only the examples it accepts itself, gathered from all its rules. So a subtype never shows a parent's example that its own rule rejects, and a variant never shows its original's.

## Making your own type describable

Regular expressions describe themselves. A type guard needs its JSON Schema as the third argument of `satisfying()`:

```ts
import { Integer, satisfying } from '@horizon-republic/nominal-types';

const isEven = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value % 2 === 0;

export class EvenNumber extends Integer.subtype(
  'EvenNumber',
  satisfying(isEven, 'an even number', { type: 'integer', multipleOf: 2 }),
) {}
```

A schema from another library works if that library supports [Standard JSON Schema](https://standardschema.dev), as ArkType does.

If any rule of a type can't describe itself, asking for the schema throws a `TypeError`.

## Keeping the schema and the type in step

JSON Schema can't express every rule. In those cases the schema is looser than the type, and the type rejects the rest at runtime. Two examples:

- `Float32` is described as a plain number.
- `Int64` limits the length of the string, not the value.

[Built-in types](../reference/types/README.md) notes each such case.

[← Guides](README.md)
