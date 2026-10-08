# How to get a JSON Schema for a type

Get a [JSON Schema](../../reference/glossary.md) for a type or a request body, for OpenAPI documents, form generators or validators in other languages.

Using `@nestjs/swagger`? See [How to document nominal types in Swagger](swagger.md) instead.

## Before you start

- Nothing extra to install. Every type, every `n.of()` schema and every `n.object()` schema can describe itself.
- The schema lives under the property [`~standard`](../../reference/glossary.md), the one every [Standard Schema](../../reference/glossary.md) library uses. Its tilde keeps it out of your editor's autocomplete.

## Quick example

Call `['~standard'].jsonSchema.input()` and name the format you need:

```ts
// schema.ts
import { Uuid } from '@horizon-republic/nominal-types';

Uuid['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { title: 'nominal.Uuid', type: 'string', pattern: '^(?:[\\dA-Fa-f]{8}-…)$', format: 'uuid',
//   minLength: 36, maxLength: 36, description: 'a UUID', example: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f' }
```

Pick the `target` by where the schema goes:

| `target`        | Use it for                             |
| --------------- | -------------------------------------- |
| `openapi-3.0`   | OpenAPI 3.0 documents                  |
| `draft-2020-12` | current JSON Schema tools, OpenAPI 3.1 |
| `draft-07`      | older JSON Schema tools                |

## Describe a request body

An `n.object()` schema describes every field and lists the required ones:

```ts
// schema.ts
import { AnyString, Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const CreateOrder = n.object({
  customer: Email,
  sku: Sku,
  quantity: PositiveInteger,
  note: n.of(AnyString).optional(),
});

CreateOrder['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { type: 'object',
//   properties: { customer: { title: 'nominal.Email', … }, sku: { title: 'shop.Sku', … }, quantity: …, note: … },
//   required: ['customer', 'sku', 'quantity'] }
```

A type with several rules, such as `PositiveInteger`, gets an `allOf`: a list of schemas that must all match, one per rule.

## Describe what a response sends

`input()` describes what a client sends. `output()` describes what your server writes back. For most types they are the same. They differ when a type takes more than one form, such as `Int64`, which takes a string or a number but is written as a string:

```ts
import { Int64 } from '@horizon-republic/nominal-types';

Int64['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { title: 'nominal.Int64', allOf: [{ anyOf: [{ type: 'string', … }, { type: 'integer', … }], … }, …] }

Int64['~standard'].jsonSchema.output({ target: 'openapi-3.0' });
// { title: 'nominal.Int64', allOf: [{ type: 'string', … }, { type: 'string', format: 'int64', … }], … }

JSON.stringify({ id: new Int64(12) }); // '{"id":"12"}'
```

## Make your own type's schema useful

Every schema has the type's name as `title`. The built-in types also add a format, length limits and an example, so tools show a real value. Give your own type the same with the third argument of `n.matching()`:

```ts
import { AnyString, n } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype(
  'shop.Sku',
  n.matching(/^[A-Z]{3}-\d{4}$/u, 'a SKU', { minLength: 8, maxLength: 8, examples: ['TEA-0042'] }),
) {}

Sku['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { title: 'shop.Sku', type: 'string', pattern: '^[A-Z]{3}-\\d{4}$', minLength: 8, maxLength: 8,
//   description: 'a SKU', example: 'TEA-0042' }
```

The second argument also becomes the message: `Sku.parse('tea')` gives `must be a SKU (was "tea")`. Keep the extra keywords true to the rule: a length limit must match what the pattern allows.

A type shows only the examples it accepts itself. A subtype never shows a parent's example that its own rule rejects.

A regular expression describes itself. A type guard needs its JSON Schema as the third argument of `n.satisfying()`:

```ts
import { Integer, n } from '@horizon-republic/nominal-types';

const isEven = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value % 2 === 0;

class EvenNumber extends Integer.subtype(
  'shop.EvenNumber',
  n.satisfying(isEven, 'an even number', { type: 'integer', multipleOf: 2 }),
) {}

EvenNumber['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { title: 'shop.EvenNumber', allOf: [{ type: 'number', … }, …, { type: 'integer', multipleOf: 2, description: 'an even number' }] }
```

A rule from another library describes itself if that library supports [Standard JSON Schema](../../reference/glossary.md), as Zod and ArkType do. ArkType has no OpenAPI 3.0 output, so for `openapi-3.0` an ArkType rule is described as `draft-07`.

## Errors

| Problem                                                             | What happens                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| a type guard without the third argument of `n.satisfying()`         | throws `TypeError: shop.EvenNumber: the schema cannot describe itself as JSON Schema` |
| a rule from a library without Standard JSON Schema, such as Valibot | throws `TypeError: shop.Code: the schema cannot describe itself as JSON Schema`       |
| an unknown `target`, such as `draft-04`                             | throws `TypeError: JSON Schema target draft-04 is not supported`                      |

## Limits

JSON Schema can't express every rule. Then the schema is looser than the type, and the type rejects the rest at runtime:

- `Float32` is described as a number with `format: 'float'`. The schema doesn't check that the value fits in 32 bits.
- `Int64` limits the length of the string, not the value.

[Built-in types](../../reference/types/README.md) notes each such case.

## See also

- [JSON Schema reference](../../reference/json-schema.md): targets, input and output, examples, `allOf`.
- [How to document nominal types in Swagger](swagger.md)
- [How to declare a type](../core/declare-a-type.md)

[← Guides](../README.md)
