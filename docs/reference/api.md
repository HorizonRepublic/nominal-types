# API

Everything `@horizon-republic/nominal-types` exports, apart from the [built-in types](types/README.md). The NestJS adapter is described in [NestJS](../guides/nestjs.md).

## Functions

### Nominal()

```ts
Nominal(name, pattern): NominalType
Nominal(name, schema): NominalType
```

Returns a class to extend. `name` has to be unique among the nominal types an application loads. `pattern` is a `RegExp` and stands for `matching(pattern)`. `schema` is any Standard Schema whose `validate` answers synchronously; a schema that answers with a Promise makes construction throw `TypeError: <name>: asynchronous schemas are not supported`.

### matching()

```ts
matching(pattern, description?): PatternSchema
```

A Standard Schema and Standard JSON Schema for the strings `pattern` matches. `pattern` may carry the `u` flag and no other; any other flag throws `TypeError` when the schema is built. `description` completes "must be …" in messages and goes into the JSON Schema.

### satisfying()

```ts
satisfying(check, description, jsonSchema?): PredicateSchema
```

A Standard Schema for the values the type guard `check` approves. `description` completes "must be …" in messages. `jsonSchema` is the JSON Schema the rule is described with, with `description` added; without it, asking for JSON Schema throws `TypeError`.

### isNominalType()

```ts
isNominalType(value): value is AnyNominalType
```

`true` for a nominal type class, including one loaded from another copy of this package, and `false` for anything else.

## Static members

| Member                      | Description                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new Type(input)`           | Validates and builds an instance; throws `NominalError`                                                                                                                                      |
| `Type.parse(input)`         | `{ ok: true, value }` or `{ ok: false, issues }`; never throws for a rejected value. Returns an instance of the type as is, and checks an instance of a related type by its value, see below |
| `Type.is(value)`            | Type guard: whether `value` is an instance of the type                                                                                                                                       |
| `Type.subtype(name, rule?)` | A new type: the parent's rules, then `rule`; its instances pass where the parent is expected                                                                                                 |
| `Type.variant(name, rule)`  | A new type: the parent's behaviour, the rules above the parent's level, then `rule`                                                                                                          |
| `Type.standard()`           | The Standard Schema as a plain object                                                                                                                                                        |
| `Type['~standard']`         | Standard Schema and Standard JSON Schema properties                                                                                                                                          |
| `Type.schema`               | The rule of the nearest class in the chain that declares one                                                                                                                                 |
| `Type.typeName`             | The name given to `Nominal()`, `subtype()` or `variant()`                                                                                                                                    |

`parse()` checks an instance of another type by its value when the target is a subtype of that type, a variant of it or the type it is a variant of, or a sibling under a common parent. An instance of an unrelated type is rejected.

## Instance members

| Member          | Description                                                             |
| --------------- | ----------------------------------------------------------------------- |
| `value`         | The validated value                                                     |
| `equals(other)` | Same type name and `Object.is` on the values; `Uuid` ignores case       |
| `toJSON()`      | The value; `AnyBigInt` and the types under it return the decimal string |
| `toString()`    | `String(value)`                                                         |

## NominalError

Thrown by `new` for a rejected value. Extends `TypeError`.

| Member     | Description                                      |
| ---------- | ------------------------------------------------ |
| `typeName` | The name of the type that rejected the value     |
| `issues`   | Plain `{ message, path? }` objects               |
| `message`  | `'Email: must be an email address (was "nope")'` |

## Messages

Messages produced by `matching()`, `satisfying()` and the built-in types read `must be <description> (was <value>)`. The value is written as follows:

| Value         | Written as             |
| ------------- | ---------------------- |
| a string      | quoted, `"nope"`       |
| a number      | `42`, `-0`, `NaN`      |
| a bigint      | `42n`                  |
| a boolean     | `true`                 |
| anything else | its `typeof`, `object` |

A pattern without a description reads `must be matched by <source>`; a pattern given a value that is not a string reads `must be a string`. Issues from other libraries keep their messages; their paths become plain keys.

## JSON Schema

`Type['~standard'].jsonSchema.input(options)` and `.output(options)` take `options.target`:

| Target          | `$schema`                                      |
| --------------- | ---------------------------------------------- |
| `draft-2020-12` | `https://json-schema.org/draft/2020-12/schema` |
| `draft-07`      | `http://json-schema.org/draft-07/schema#`      |
| `openapi-3.0`   | none                                           |

Any other target throws `TypeError: JSON Schema target <target> is not supported`. A type with several rules is described as an `allOf` of them from the root down, with `$schema` once at the top. A type with a rule that cannot describe itself throws `TypeError`.

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
| `StandardProps` / `StandardSchema`    | The shape of `~standard` and of what `standard()` returns      |

[← Documentation](../README.md)
