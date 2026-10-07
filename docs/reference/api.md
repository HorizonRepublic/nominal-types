# API

Everything the package exports, except the [built-in types](types/README.md). For the NestJS pipe, see [How to validate NestJS route parameters](../guides/nestjs.md). Terms are explained in the [glossary](glossary.md).

## Functions

### Nominal()

```ts
Nominal(name, rule): NominalType
```

Returns a class to extend.

| Parameter | Description                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- |
| `name`    | The type's name. Must be unique in the application.                                           |
| `rule`    | A `RegExp`, the result of `matching()` or `satisfying()`, or any synchronous Standard Schema. |

A schema that answers asynchronously throws `TypeError: <name>: asynchronous schemas are not supported` when a value is checked.

### matching()

```ts
matching(pattern, description?, jsonSchema?): PatternSchema
```

A rule for strings that match `pattern`.

| Parameter     | Description                                                                  |
| ------------- | ---------------------------------------------------------------------------- |
| `pattern`     | A `RegExp` with the `u` flag or no flags. Any other flag throws `TypeError`. |
| `description` | Optional. Ends the message `must be …`, and goes into the JSON Schema.       |

### satisfying()

```ts
satisfying(check, description, jsonSchema?): PredicateSchema
```

A rule for values that a type guard accepts.

| Parameter     | Description                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------- |
| `check`       | A type guard, `(value: unknown) => value is T`.                                               |
| `description` | Ends the message `must be …`.                                                                 |
| `jsonSchema`  | Optional. The JSON Schema of the rule. Without it, asking for JSON Schema throws `TypeError`. |

### schemaOf()

```ts
schemaOf(Type): TypeSchema
```

A nominal type as a plain Standard Schema object. Throws `TypeError` if `Type` is not a nominal type. See [How to validate arrays and optional values](../guides/arrays-and-optional.md).

| Member of `TypeSchema` | Returns                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `parse(input)`         | `{ ok: true, value }` or `{ ok: false, issues }`. Doesn't throw.                          |
| `array(options?)`      | A schema for a frozen array of values this schema accepts.                                |
| `fromString()`         | A schema that reads a string as a number or boolean first. Only right after `schemaOf()`. |
| `optional()`           | A schema that also accepts `undefined`.                                                   |
| `nullable()`           | A schema that also accepts `null`.                                                        |
| `['~standard']`        | The Standard Schema and Standard JSON Schema interface.                                   |

Every method returns a new schema and leaves the old one as it is. `fromString()` throws `TypeError` after another method, or for a type with no text form, such as one made with `Nominal()`. See [How to read values from strings](../guides/reading-strings.md).

Options of `array()`:

| Option   | Meaning                  |
| -------- | ------------------------ |
| `length` | exactly this many items  |
| `min`    | at least this many items |
| `max`    | at most this many items  |

Each option must be a whole number from 0 up. `length` can't be combined with `min` or `max`, and `min` can't be greater than `max`. Otherwise `array()` throws `TypeError`.

How each schema is described as JSON Schema:

| Schema        | JSON Schema                                                                            |
| ------------- | -------------------------------------------------------------------------------------- |
| `schemaOf(T)` | the same as `T`                                                                        |
| `.array()`    | `{ type: 'array', items, minItems, maxItems }`                                         |
| `.optional()` | the same as the inner schema; leave the property out of `required`                     |
| `.nullable()` | `{ anyOf: [inner, { type: 'null' }] }`; for `openapi-3.0`, inner with `nullable: true` |

Messages of `array()`:

| Case              | Message                                      |
| ----------------- | -------------------------------------------- |
| not an array      | `must be an array (was 42)`                  |
| wrong exact count | `must have 3 items (was 2)`                  |
| too few           | `must have at least 1 item (was 0)`          |
| too many          | `must have at most 10 items (was 11)`        |
| a bad item        | the item's message, with its index in `path` |

### isNominalType()

```ts
isNominalType(value): value is AnyNominalType
```

`true` if `value` is a nominal type class, also one from another copy of the package.

## Static members

| Member                      | Description                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `new Type(input)`           | Checks `input` and creates an instance. Throws `NominalError` if it's invalid.                                                           |
| `Type.parse(input)`         | Returns `{ ok: true, value }` or `{ ok: false, issues }`. Doesn't throw.                                                                 |
| `value instanceof Type`     | `true` if `value` is an instance of the type, also one created by another copy of the package.                                           |
| `Type.subtype(name, rule?)` | A new, narrower type. See [subtypes](../guides/building-on-types.md#adding-a-stricter-rule).                                             |
| `Type.variant(name, rule)`  | A sibling type with a different rule. See [variants](../guides/building-on-types.md#accepting-different-values-with-the-same-behaviour). |
| `Type['~standard']`         | The Standard Schema and Standard JSON Schema interface.                                                                                  |
| `Type.rule`                 | Only the rule of the type's own level, or the closest parent's if it adds none. For the whole type, use `schemaOf(Type)`.                |
| `Type.typeName`             | The type's name.                                                                                                                         |

What `parse()` does with different inputs:

| Input                                           | Result                                        |
| ----------------------------------------------- | --------------------------------------------- |
| a plain value                                   | checked against all the type's rules          |
| an instance of the same type or of a subtype    | returned as it is, without a check            |
| an instance of a parent, a variant or a sibling | its value is checked against the type's rules |
| an instance of an unrelated type                | rejected                                      |

## Instance members

| Member          | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| `value`         | The checked value.                                                |
| `equals(other)` | `true` for the same type and the same value. `Uuid` ignores case. |
| `toJSON()`      | The value. `AnyBigInt` and its subtypes return a decimal string.  |
| `toString()`    | `String(value)`                                                   |

## NominalError

Thrown by `new` when a value is invalid. It extends `TypeError`.

| Member     | Description                                      |
| ---------- | ------------------------------------------------ |
| `typeName` | The name of the type that rejected the value.    |
| `issues`   | A list of `{ message, path? }` objects.          |
| `message`  | `'Email: must be an email address (was "nope")'` |

## Messages

Messages from `matching()`, `satisfying()` and the built-in types look like `must be <description> (was <value>)`. The value is shown like this:

| Value         | Written as             |
| ------------- | ---------------------- |
| a string      | quoted, `"nope"`       |
| a number      | `42`, `-0`, `NaN`      |
| a bigint      | `42n`                  |
| a boolean     | `true`                 |
| anything else | its `typeof`, `object` |

Special cases:

- A pattern without a description: `must be matched by <pattern>`.
- A pattern given a value that isn't a string: `must be a string (was …)`.
- Rules from other libraries keep their own messages.

## JSON Schema

Get a schema with `Type['~standard'].jsonSchema.input({ target })` or `.output({ target })`. The targets are:

| Target          | `$schema`                                      |
| --------------- | ---------------------------------------------- |
| `draft-2020-12` | `https://json-schema.org/draft/2020-12/schema` |
| `draft-07`      | `http://json-schema.org/draft-07/schema#`      |
| `openapi-3.0`   | none                                           |

Notes:

- Any other target throws `TypeError: JSON Schema target <target> is not supported`.
- Every type gets its name as `title`, unless its rule sets one.
- A type with several rules gets an `allOf`, one entry per rule, with `$schema` once at the top.
- Examples from all the type's rules move to the top, and only those the type accepts are kept. For `openapi-3.0`, which has no `examples` on a schema, the first one becomes `example`.
- If a rule can't describe itself, the call throws `TypeError`.

## Types

| Type                                  | Description                                                    |
| ------------------------------------- | -------------------------------------------------------------- |
| `NominalType<Name, Schema>`           | A class returned by `Nominal()`                                |
| `SubtypeOf<Parent, Name>`             | A class returned by `subtype()`                                |
| `VariantOf<Source, Name>`             | A class returned by `variant()`                                |
| `VariantInstance<Source, Name>`       | An instance of a variant                                       |
| `AnyNominalType`                      | Any nominal type class                                         |
| `NominalInstance<Name, Value>`        | What every instance offers                                     |
| `NominalSchema<Input, Value>`         | What `Nominal()`, `subtype()` and `variant()` accept as a rule |
| `PatternSchema` / `PredicateSchema`   | The classes `matching()` and `satisfying()` return             |
| `Parsed<Instance>`                    | The result of `parse()`                                        |
| `Brand<Name>`                         | The compile-time marker that keeps types apart                 |
| `InputOf<Schema>` / `ValueOf<Schema>` | The input and the value type of a schema                       |
| `TypeSchema` / `ArrayOptions`         | What `schemaOf()` returns, and the options of `array()`        |
| `StandardProps` / `StandardSchema`    | The shape of `~standard` and of a plain schema object          |

[← Reference](README.md)
