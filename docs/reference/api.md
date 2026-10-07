# API

## Nominal()

```ts
Nominal(name, schema);
Nominal(name, pattern);
```

Returns a class to extend. `name` has to be unique within an application. `schema` is any Standard Schema whose `validate` answers synchronously; a schema that also carries a Standard JSON Schema converter lets the type describe itself. A regular expression stands for `matching(pattern)`.

## matching()

```ts
matching(pattern, description?): PatternSchema
```

A Standard Schema and Standard JSON Schema for the strings `pattern` matches. Nominal types test the pattern directly, so a type built on one costs little more than the pattern itself. Only the `u` flag is allowed. `description` completes "must be …" in error messages and goes into the JSON Schema.

## Static members

| Member                      | Description                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `new Type(input)`           | Validates and builds an instance; throws `NominalError`                                                                                     |
| `Type.parse(input)`         | `{ ok: true, value }` or `{ ok: false, issues }`; never throws; returns an existing instance as is and narrows an instance of a parent type |
| `Type.is(value)`            | Type guard                                                                                                                                  |
| `Type.subtype(name, rule?)` | A new type with the parent's rules and, optionally, one more                                                                                |
| `Type.variant(name, rule)`  | A new type with the parent's behaviour and `rule` in place of the parent's own                                                              |
| `Type.standard()`           | The Standard Schema as a plain object, for libraries that parse definitions                                                                 |
| `Type['~standard']`         | Standard Schema and Standard JSON Schema properties                                                                                         |
| `Type.schema`               | The schema the type validates with                                                                                                          |
| `Type.typeName`             | The name given to `Nominal()`                                                                                                               |

## Instance members

| Member          | Description                              |
| --------------- | ---------------------------------------- |
| `value`         | The validated value                      |
| `equals(other)` | Same type and same value                 |
| `toJSON()`      | The value, so `JSON.stringify` writes it |
| `toString()`    | The value as a string                    |

## NominalError

Thrown by `new` for a rejected value. Extends `TypeError`.

| Member     | Description                                      |
| ---------- | ------------------------------------------------ |
| `typeName` | The name of the type that rejected the value     |
| `issues`   | Plain `{ message, path? }` objects               |
| `message`  | `'Email: must be an email address (was "nope")'` |

## satisfying()

```ts
satisfying(check, description, jsonSchema?): PredicateSchema
```

A Standard Schema for the values the type guard `check` approves. Nominal types call the guard directly. `description` completes "must be …" in error messages; `jsonSchema`, when given, is what the type describes itself as, with the description added. Without it, asking for JSON Schema throws.

## isNominalType()

```ts
isNominalType(value): value is AnyNominalType
```

Whether a value is a nominal type class, including one loaded from another copy of this package. Adapters use it to spot a nominal type among the parameter types NestJS and similar libraries reflect.

## Types

| Type                                  | Description                                                    |
| ------------------------------------- | -------------------------------------------------------------- |
| `NominalType<Name, Schema>`           | A class returned by `Nominal()`                                |
| `VariantOf<Source, Name>`             | A class returned by `variant()`                                |
| `SubtypeOf<Parent, Name>`             | A class returned by `subtype()`                                |
| `AnyNominalType`                      | Any nominal type class, for code that accepts them generically |
| `NominalInstance<Name, Value>`        | What every instance offers                                     |
| `NominalSchema<Input, Value>`         | What `Nominal()` accepts as a schema                           |
| `Parsed<Instance>`                    | The result of `parse()`                                        |
| `Brand<Name>`                         | The compile-time marker that keeps types apart                 |
| `InputOf<Schema>` / `ValueOf<Schema>` | The input and the value type of a schema                       |
| `StandardProps` / `StandardSchema`    | The shape of `~standard` and of what `standard()` returns      |

[← Documentation](../README.md)
