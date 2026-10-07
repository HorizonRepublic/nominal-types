# How to generate JSON Schema

This guide shows how to get the JSON Schema of a type, for OpenAPI documents, form generators or a validator in another language.

## Getting a type's schema

Call `jsonSchema.input()` on the type's `~standard` with the target you need:

```ts
Uuid['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { type: 'string', pattern: '^(?:[\\dA-Fa-f]{8}-…)$', description: 'a UUID' }

Uuid['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
// the same, with $schema: 'https://json-schema.org/draft/2020-12/schema' first
```

The targets are `draft-2020-12`, `draft-07` and `openapi-3.0`. Use `output()` for the shape a response carries. For the built-in types both are the same; a schema from a library that converts values may describe them differently.

A type with several rules is described as an `allOf` of them, from the root down:

```ts
PositiveInteger['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { allOf: [{ type: 'number', … }, …, { type: 'integer', minimum: 1, … }] }
```

## Making your own type describable

Patterns describe themselves. A `satisfying()` rule needs the JSON Schema it corresponds to as its third argument:

```ts
const isEven = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value % 2 === 0;

export class EvenNumber extends Integer.subtype(
  'EvenNumber',
  satisfying(isEven, 'an even number', { type: 'integer', multipleOf: 2 }),
) {}
```

A schema from a library describes itself if the library supports [Standard JSON Schema](https://standardschema.dev), as ArkType does. Asking for the schema of a type with a rule that can't describe itself throws a `TypeError`.

## Keeping the schema and the type in step

JSON Schema can't express every rule. Where it can't, the schema accepts more than the type, and the type rejects the rest when the value arrives: `Float32` is described as a plain number, and `Int64` limits the length of its string rather than its range. [Built-in types](../reference/types/README.md) notes each such case.

[← Documentation](../README.md)
