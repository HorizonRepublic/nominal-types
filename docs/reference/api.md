# API

Everything the package exports, except the [built-in types](types/README.md). For the NestJS pipe, see [How to validate NestJS route parameters](../guides/nestjs.md). Terms are explained in the [glossary](glossary.md).

## Functions

### Nominal()

```ts
Nominal(name, rule, options?): NominalType
```

Returns a class to extend.

| Parameter | Description                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`    | The type's name. Must be unique in the application. Parts of letters, digits, `_` and `-`, joined by dots: `Sku`, `billing.InvoiceNumber`. |
| `rule`    | A `RegExp`, the result of `matching()` or `satisfying()`, or any synchronous Standard Schema.                                              |
| `options` | `{ sensitive?: boolean }`. `sensitive: true` leaves rejected values out of the type's messages. Subtypes and variants inherit it.          |

Any other name, such as `billing/Email` or one with a space, throws a `TypeError` when the type is declared. The name becomes the schema name in OpenAPI, which allows no other characters. The same rule holds for `subtype()` and `variant()`.

The built-in types are named under `nominal.`, such as `nominal.Email`, so a type of your own may be called `Email`.

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
| `array(options?)`      | A schema for a new array of values this schema accepts, read-only by type.                |
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

### objectOf()

```ts
objectOf(fields, ...constraints): ObjectSchema
```

A schema for an object whose fields are checked by their own schemas. See [How to check an object with objectOf()](../guides/objects.md).

| Parameter     | Description                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `fields`      | An object that maps each key to a nominal type, a `schemaOf()` or `objectOf()` schema, or any synchronous Standard Schema. |
| `constraints` | Optional. [Constraints](#constraint) that run once every field is valid.                                                   |

What it does with an input:

1. It refuses anything that isn't a plain object: `must be an object (was "x")`.
2. It checks every field and collects every issue, with the field's key at the start of its `path`.
3. A field whose schema accepts `undefined` may be missing; it is left out of the result.
4. Keys it doesn't declare are dropped. With `strict()`, each is an issue: `is not allowed`.
5. It runs the constraints.
6. It returns a new object, read-only by type. The input is left as it was.

`ObjectSchema` is a `TypeSchema`, so `array()`, `optional()` and `nullable()` work on it, as do `parse()` and `~standard`. It adds:

| Member      | Description                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `strict()`  | The same schema, refusing undeclared keys instead of dropping them                                                                   |
| `fromEnv()` | The same schema, reading each field of a nominal type with a text form from a string; for `process.env` and other records of strings |
| `keys`      | The field names, in the order they were declared                                                                                     |

Its JSON Schema is `{ type: 'object', properties, required }`. The output side, and the input side of a strict schema, add `additionalProperties: false`.

A field named `__proto__` throws a `TypeError`.

Given to `Nominal()`, it makes a class whose instances have a getter for each field and `copyWith()`. See [Instance members](#instance-members).

### isObjectSchema()

```ts
isObjectSchema(value): value is ObjectSchema
```

`true` if `value` was made by `objectOf()`, also in another copy of the package.

### constraint()

```ts
constraint(fields, check, options?): Constraint
```

A rule across fields of an object, like a `CHECK` constraint over several columns in SQL. See [How to check one field against another](../guides/checking-fields-together.md).

| Parameter | Description                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fields`  | An object that maps each field the rule reads to a nominal type, a `schemaOf()` schema or any synchronous Standard Schema.                                         |
| `check`   | `(values) => true \| false \| string`. Gets the checked values of the listed fields. `true` passes, `false` fails with `message`, a string fails with that string. |
| `options` | Optional. `path`: the field the issue belongs to, or a path to it. `message`: the message for `false`.                                                             |

What a constraint does with an object:

1. It checks each listed field against its type. A field that fails gives its own issue, with the field's key in `path`, and `check` doesn't run.
2. It calls `check` with the values: instances for nominal types.
3. It returns a copy of the object with the checked values in place. Keys that aren't listed pass through unchecked.

A constraint is a Standard Schema and a Standard JSON Schema. Give it to `objectOf()`, or to an adapter's `constrain…()`; for a value object, make a type on `objectOf()` with it. Its JSON Schema is an object with the listed fields in `properties` and the ones that can't be `undefined` in `required`; `check` itself has no JSON Schema form.

Messages:

| Case                                 | Message                                        |
| ------------------------------------ | ---------------------------------------------- |
| not an object                        | `must be an object (was "x")`                  |
| `check` returns `false`, with `path` | `must agree with <other fields>`, or `message` |
| `check` returns `false`, no `path`   | `<fields> must agree`, or `message`            |
| `check` returns a string             | the string                                     |

### isConstraint()

```ts
isConstraint(value): value is Constraint
```

`true` if `value` was made by `constraint()`, also in another copy of the package.

### isNominalType()

```ts
isNominalType(value): value is AnyNominalType
```

`true` if `value` is a nominal type class, also one from another copy of the package.

## Static members

| Member                                | Description                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `new Type(input)`                     | Checks `input` and creates an instance. Throws `NominalError` if it's invalid.                                                           |
| `Type.parse(input)`                   | Returns `{ ok: true, value }` or `{ ok: false, issues }`. Doesn't throw.                                                                 |
| `value instanceof Type`               | `true` if `value` is an instance of the type, also one created by another copy of the package.                                           |
| `Type.subtype(name, rule?, options?)` | A new, narrower type. See [subtypes](../guides/building-on-types.md#adding-a-stricter-rule).                                             |
| `Type.variant(name, rule, options?)`  | A sibling type with a different rule. See [variants](../guides/building-on-types.md#accepting-different-values-with-the-same-behaviour). |
| `Type['~standard']`                   | The Standard Schema and Standard JSON Schema interface.                                                                                  |
| `Type.rule`                           | Only the rule of the type's own level, or the closest parent's if it adds none. For the whole type, use `schemaOf(Type)`.                |
| `Type.typeName`                       | The type's name.                                                                                                                         |

What `parse()` does with different inputs:

| Input                                           | Result                                        |
| ----------------------------------------------- | --------------------------------------------- |
| a plain value                                   | checked against all the type's rules          |
| an instance of the same type or of a subtype    | returned as it is, without a check            |
| an instance of a parent, a variant or a sibling | its value is checked against the type's rules |
| an instance of an unrelated type                | rejected                                      |

## Instance members

| Member          | Description                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`         | The checked value. An object or array value is frozen all the way down, and typed `Immutable<Value>`.                                                                                                         |
| `equals(other)` | `true` for the same value in one line of types: the same type, a type under it or the type it is under. Siblings and variants are not equal. Objects and arrays are compared key by key. `Uuid` ignores case. |
| `toJSON()`      | The value. `AnyBigInt` and its subtypes return a decimal string.                                                                                                                                              |
| `toString()`    | `String(value)`, or JSON text for an object value.                                                                                                                                                            |

An instance stands for its value where JavaScript needs a plain value:

| Expression       | Value is a number, bigint, string or boolean | Value is an object       |
| ---------------- | -------------------------------------------- | ------------------------ |
| `end > start`    | compares the values                          | throws a `TypeError`     |
| `Number(count)`  | the value as a number                        | throws a `TypeError`     |
| `` `${email}` `` | the value as text                            | JSON text, `{"start":1}` |

Compare the fields of an object value through `value`: `range.value.end > range.value.start`.

A type built on `objectOf()` adds to its instances:

| Member              | Description                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| a getter per field  | `stay.guests` reads `stay.value.guests`                                                                     |
| `copyWith(changes)` | A new instance with the given fields changed and the others kept, checked like `new`; throws `NominalError` |

Its fields can't be named `value`, `equals`, `copyWith`, `toJSON`, `toString` or `constructor`; `Nominal()` throws a `TypeError` for them.

When an object value is frozen, the input stays yours: the type copies it first. An input that is already frozen all the way down is kept without a copy.

## NominalError

Thrown by `new` when a value is invalid. It extends `TypeError`.

| Member     | Description                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typeName` | The name of the type that rejected the value.                                                                                                                        |
| `issues`   | A list of `{ message, path? }` objects.                                                                                                                              |
| `message`  | `'nominal.Email: must be an email address (was a string of 4 characters)'`; an issue with a path shows it first: `'Occupancy: guests: must not exceed the capacity'` |

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
- A type declared with `sensitive: true` writes its value by kind: `(was a string of 7 characters)`, `(was a number)`. So does the built-in `Email`.

### hideValues()

```ts
hideValues(issues): issues
```

Returns the issues with the value at the end of each message replaced by its kind, as for a sensitive type. It reads `(was "x")` and Valibot's `received "x"`, and leaves other messages as they are. See [How to keep values out of error messages](../guides/hiding-values.md).

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

| Type                                                                             | Description                                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `NominalType<Name, Schema>`                                                      | A class returned by `Nominal()`                                                                        |
| `SubtypeOf<Parent, Name>`                                                        | A class returned by `subtype()`                                                                        |
| `VariantOf<Source, Name>`                                                        | A class returned by `variant()`                                                                        |
| `VariantInstance<Source, Name>`                                                  | An instance of a variant                                                                               |
| `AnyNominalType`                                                                 | Any nominal type class                                                                                 |
| `NominalInstance<Name, Value>`                                                   | What every instance offers                                                                             |
| `NominalSchema<Input, Value>`                                                    | What `Nominal()`, `subtype()` and `variant()` accept as a rule                                         |
| `PatternSchema` / `PredicateSchema`                                              | The classes `matching()` and `satisfying()` return; both have `accepts(value)` and `messageFor(value)` |
| `Parsed<Instance>`                                                               | The result of `parse()`                                                                                |
| `Brand<Name>`                                                                    | The compile-time marker that keeps types apart                                                         |
| `Immutable<Value>`                                                               | `Value` with its objects and arrays read-only all the way down                                         |
| `InputOf<Schema>` / `ValueOf<Schema>`                                            | The input and the value type of a schema                                                               |
| `TypeSchema` / `ArrayOptions`                                                    | What `schemaOf()` returns, and the options of `array()`                                                |
| `Constraint<Fields>` / `ConstraintOptions`                                       | What `constraint()` returns, and its options                                                           |
| `ConstraintField` / `ConstraintValues`                                           | What a field of a constraint can be, and the values `check` receives                                   |
| `ConstraintInput` / `ConstraintInputs` / `ConstraintValue` / `ConstraintVerdict` | The input of one field and of the object, the value of one field, and what `check` returns             |
| `NominalTarget` / `TargetValue`                                                  | A nominal type or a `schemaOf()` schema, and the value it gives                                        |
| `StandardProps` / `StandardSchema`                                               | The shape of `~standard` and of a plain schema object                                                  |

[← Reference](README.md)
