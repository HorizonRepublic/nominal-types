# Glossary

| Term            | Meaning                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| nominal type    | A type told apart by its name, not its shape. `Email` and `Uuid` both wrap a string but don't mix.                        |
| instance        | An object made by `new Email(…)` or `Email.parse(…)`. It always holds a valid value.                                      |
| value           | What an instance wraps, read through `instance.value`: the string, number, bigint or boolean.                             |
| rule            | What a valid value looks like: a regular expression, a type guard or a schema from another library.                       |
| type guard      | A function `(value: unknown) => value is T` that returns `true` for a valid value.                                        |
| issue           | One reason a value was rejected: `{ message, path? }`.                                                                    |
| base type       | One of the roots `AnyString`, `AnyNumber`, `AnyBigInt`, `AnyBoolean`.                                                     |
| subtype         | A narrower type made with `subtype()`. It fits where its parent is expected, not the other way round.                     |
| variant         | A sibling type made with `variant()`. Same methods as the original, a different rule, and the two don't mix.              |
| level           | One step in a chain of types, such as `Integer` in `AnyNumber` › `FiniteNumber` › `Integer`.                              |
| brand           | The hidden marker that makes the compiler tell types apart.                                                               |
| `schemaOf()`    | Turns a type into a plain schema object, to build lists and optional values from: `schemaOf(Uuid).array()`.               |
| `fromString()`  | A step that reads a number or boolean from text first, such as `'2'` from a query string.                                 |
| Standard Schema | A common interface for validators, [standardschema.dev](https://standardschema.dev). Zod, Valibot and ArkType support it. |
| JSON Schema     | A JSON format for describing data, used by OpenAPI and many tools.                                                        |

[← Reference](README.md)
