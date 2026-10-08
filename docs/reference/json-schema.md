# JSON Schema

How types and schemas describe themselves as [JSON Schema](glossary.md). Every nominal type, `n.of()` schema, `n.object()` schema and constraint does it through `['~standard'].jsonSchema`, the [Standard JSON Schema](glossary.md) interface.

## input() and output()

```ts
Type['~standard'].jsonSchema.input(options): Record<string, unknown>
Type['~standard'].jsonSchema.output(options): Record<string, unknown>
```

| Parameter        | Type                                             | Description          |
| ---------------- | ------------------------------------------------ | -------------------- |
| `options.target` | `'draft-2020-12' \| 'draft-07' \| 'openapi-3.0'` | The format to write. |

| Method     | Describes                                             |
| ---------- | ----------------------------------------------------- |
| `input()`  | what the type accepts, such as a request body         |
| `output()` | what the value is written as, such as a response body |

The two differ in two places:

| Schema                             | `input()`                                    | `output()`                    |
| ---------------------------------- | -------------------------------------------- | ----------------------------- |
| `AnyBigInt` and the types under it | a string or an integer, joined by `anyOf`    | a string only                 |
| `n.object()`                       | no `additionalProperties`, unless `strict()` | `additionalProperties: false` |

Throws: a `TypeError` for an unknown target, or when a rule can't describe itself. See [Errors when declaring and describing](errors-and-messages.md#errors-when-declaring-and-describing).

Example:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

Sku['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
// { $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'shop.Sku', type: 'string', pattern: '^[A-Z]{3}-\\d{4}$' }
Sku['~standard'].jsonSchema.input({ target: 'draft-04' }); // throws TypeError: JSON Schema target draft-04 is not supported
```

See also: [How to get a JSON Schema for a type](../guides/api-docs/json-schema.md).

## Targets

| Target          | Use it for                             | `$schema`                                      | Examples                                            |
| --------------- | -------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| `draft-2020-12` | current JSON Schema tools, OpenAPI 3.1 | `https://json-schema.org/draft/2020-12/schema` | `examples: [...]`                                   |
| `draft-07`      | older JSON Schema tools                | `http://json-schema.org/draft-07/schema#`      | `examples: [...]`                                   |
| `openapi-3.0`   | OpenAPI 3.0 documents                  | none                                           | `example`: the first example the whole type accepts |

`$schema` appears once, at the top. Schemas nested inside, such as fields and items, have none.

For `openapi-3.0`, a rule from a library that doesn't write OpenAPI 3.0, such as ArkType, is described as for `draft-07`, without `$schema`.

OpenAPI 3.0 has no `contentEncoding`. For `openapi-3.0`, `contentEncoding: 'base64'` becomes `format: 'byte'`, and any other `contentEncoding` is left out.

OpenAPI 3.0 writes an exclusive bound as a flag. For `openapi-3.0`, `exclusiveMinimum: 0` becomes `minimum: 0, exclusiveMinimum: true`, and the same goes for `exclusiveMaximum`.

## A type's schema

| Part          | Rule                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `title`       | The type name, such as `shop.Sku`, unless the rule sets its own `title`.                        |
| one rule      | The rule's schema, at the top level.                                                            |
| several rules | One schema, merged from the rules where they fit together. See [Several rules](#several-rules). |
| `description` | The description given to `n.matching()` or `n.satisfying()`, or the list of `n.oneOf()`.        |
| examples      | Gathered from all the rules. Only the examples the whole type accepts are kept.                 |

The string check of `AnyString` is left out when the next rule checks for a string itself. So a subtype of `AnyString` made from a pattern, or from `n.oneOf()` with strings only, has one rule.

A rule from `n.oneOf()` is described by `enum`:

```ts
import { AnyString, n } from '@horizon-republic/nominal-types';

class OrderStatus extends AnyString.subtype('shop.OrderStatus', n.oneOf('draft', 'paid', 'shipped')) {}

OrderStatus['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { title: 'shop.OrderStatus', type: 'string', enum: ['draft', 'paid', 'shipped'], description: 'one of "draft", "paid", "shipped"' }
```

## Several rules

A type with several rules gets one schema. The rules are merged from the top of the line of types down:

- `number` and `integer` give `integer`.
- Of two bounds on the same side, the stricter one is kept.
- Of two number formats, the narrower one is kept: `float` before `double`, `int32` before `int64`. An `integer` keeps no `double`.
- The description of the last rule is kept.

Example:

```ts
import { PositiveInteger } from '@horizon-republic/nominal-types';

PositiveInteger['~standard'].jsonSchema.input({ target: 'draft-07' });
// {
//   $schema: 'http://json-schema.org/draft-07/schema#',
//   title: 'nominal.PositiveInteger',
//   type: 'integer',
//   minimum: 1,
//   maximum: 9007199254740991,
//   description: 'a positive integer',
// }
```

Rules that don't fit together stay apart, in an `allOf`: a list of schemas that must all match. That happens for two different patterns, two different formats, or a keyword such as `nullable` or `properties`.

Example of examples: `ToySku` keeps only the example of `Sku` that it accepts:

```ts
import { AnyString, n } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype(
  'shop.Sku',
  n.matching(/^[A-Z]{3}-\d{4}$/u, 'a SKU', { examples: ['ABC-1234', 'TOY-0001'] }),
) {}
class ToySku extends Sku.subtype('shop.ToySku', n.matching(/^TOY-/u, 'a toy SKU')) {}

ToySku['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
// { $schema: '…', title: 'shop.ToySku', allOf: [{ … }, { … }], examples: ['TOY-0001'] }
ToySku['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
// { title: 'shop.ToySku', allOf: [{ … }, { … }], example: 'TOY-0001' }
```

## Schemas built from types

| Schema                                                         | JSON Schema                                                                                                                                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `n.of(T)`                                                      | the same as `T`                                                                                                                                                                                    |
| `.array(options)`                                              | `{ type: 'array', items, minItems, maxItems, uniqueItems }`; `minItems` only above 0, `maxItems` only with a limit, `uniqueItems: true` only with `unique: true`                                   |
| `.optional()`                                                  | the same as the inner schema; an `n.object()` leaves the field out of `required`                                                                                                                   |
| `.nullable()`                                                  | `{ anyOf: [inner, { type: 'null' }] }`; for `openapi-3.0`, the inner schema with `nullable: true`                                                                                                  |
| `.fromString()`                                                | the same as the inner schema: it describes the value, not the text                                                                                                                                 |
| `n.object(fields)`                                             | `{ type: 'object', properties, required }`, each field by its own schema                                                                                                                           |
| `.strict()`                                                    | adds `additionalProperties: false` on the input side too                                                                                                                                           |
| a nominal type on `n.object()`                                 | the object schema with the type name as `title`                                                                                                                                                    |
| `.partial()`, `.required()`, `.pick()`, `.omit()`, `.extend()` | the object schema of the fields the new schema has, with `required` as changed                                                                                                                     |
| `n.union(key, variants)`                                       | `{ oneOf }` of the variants, each with `properties[key] = { const: tag }` and `key` in `required`; for `openapi-3.0`, `{ type: 'string', enum: [tag] }` and `discriminator: { propertyName: key }` |
| `n.constraint(fields, check)`                                  | `{ type: 'object', properties, required }` of the listed fields; `check` is not described                                                                                                          |

`required` lists the fields whose schema doesn't accept `undefined`, unless `partial()` or `required()` changed them.

Example:

```ts
import { AnyString, Email, n } from '@horizon-republic/nominal-types';

const Invite = n.object({ email: Email, note: n.of(AnyString).optional() });

Invite['~standard'].jsonSchema.output({ target: 'openapi-3.0' });
// {
//   type: 'object',
//   properties: { email: { title: 'nominal.Email', … }, note: { title: 'nominal.AnyString', … } },
//   required: ['email'],
//   additionalProperties: false,
// }
```

## Where the schema is looser than the type

JSON Schema can't express every rule. Then the schema accepts more than the type, and the type rejects the rest at runtime.

| Type                                                                                                                 | What the schema leaves out                                                         |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Float32`                                                                                                            | exactness as a 32-bit float; the schema is `{ type: 'number', format: 'float' }`   |
| `Int64`, `Uint64`                                                                                                    | the range; the schema limits the length of the string only                         |
| a rule from `n.satisfying()`                                                                                         | whatever the guard checks beyond the `json` you give                               |
| a constraint                                                                                                         | the `check` function                                                               |
| `array({ unique: true })` of a type whose `equals()` ignores how the value is written, such as `Uuid` or `IpAddress` | that items written differently can repeat; `uniqueItems` compares the text exactly |
| `LanguageTag`                                                                                                        | that a variant or an extension is not written twice                                |
| `MediaType`                                                                                                          | that a parameter name is not given twice                                           |
| `Hostname`, `DomainName`                                                                                             | the check that an `xn--` label decodes                                             |
| `IpPrefix` and its subtypes                                                                                          | the check that the host bits are zero                                              |
| `Isbn`, `Issn`, `Gtin`, `Isin`                                                                                       | the check digit                                                                    |
| `Iban`                                                                                                               | the rules of each country and the check digits                                     |
| `Bic`                                                                                                                | the check that the country exists                                                  |
| `E164PhoneNumber`                                                                                                    | the check that the country calling code is assigned                                |
| `Jwt`                                                                                                                | the check that the header and the payload are JSON objects                         |

[← Reference](README.md)
