# Glossary

The terms these pages use, in alphabetical order.

| Term                        | Meaning                                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| adapter                     | An optional part of the package that connects nominal types to one library, such as Zod or MikroORM. Each has its own entry point. See [Adapters](adapters/README.md). |
| aggregate                   | In domain-driven design, a group of entities changed together as one unit, such as an order and its lines.                                                             |
| another copy of the package | The package loaded twice in one application, such as once with `import` and once with `require`. Types, instances and schemas from both copies work together.          |
| base64                      | Bytes written as text: letters, digits, two more characters and `=` at the end, such as `aGVsbG8=` for `hello`. Base64url uses `-` and `_`, without `=`.               |
| base type                   | One of the roots `AnyString`, `AnyNumber`, `AnyBigInt`, `AnyBoolean`. Types under them have a text form.                                                               |
| BCP 47                      | The standard for language tags such as `en-US`: a language, then an optional script, region and other parts, joined by `-`.                                            |
| boundary                    | A place where data enters your code, such as an HTTP request, an environment variable or a database row.                                                               |
| bounded context             | In domain-driven design, a part of a system with its own meaning for its words. A type name such as `billing.Email` names it.                                          |
| brand                       | The hidden marker that makes the compiler tell types apart.                                                                                                            |
| constraint                  | A rule across fields of an object, such as guests that must not exceed a capacity. Made with `constraint()`.                                                           |
| `copyWith()`                | The method of an instance built on `objectOf()` that returns a new, checked instance with some fields changed.                                                         |
| decorator                   | A function written as `@Name()` above a class or property, such as `@NominalField()`. NestJS and class-validator use them.                                             |
| domain-driven design (DDD)  | A way to design software around the words and rules of the business. See [Nominal types in domain-driven design](../explanation/domain-driven-design.md).              |
| DTO                         | Data transfer object: a class that describes the shape of a request body, as in NestJS with class-validator.                                                           |
| entity                      | In domain-driven design, an object with an identity of its own, such as an order with an id. Two entities with the same fields are still two.                          |
| entry point                 | A path you import from, such as `@horizon-republic/nominal-types/adapters/zod`. The core is `@horizon-republic/nominal-types`.                                         |
| `fromString()`              | A step that reads a number or boolean from text first, such as `'2'` from a query string.                                                                              |
| frozen                      | Made read-only with `Object.freeze`. An object or array value of an instance is frozen all the way down.                                                               |
| instance                    | An object made by `new Email(…)` or `Email.parse(…)`. It always holds a valid value.                                                                                   |
| invariant                   | A rule that always holds for a value, such as a stay's guests never exceeding its capacity.                                                                            |
| ISO 3166-1                  | The standard list of country codes. Its two-letter codes, such as `US` and `UA`, are the ones `CountryCode` takes.                                                     |
| ISO 4217                    | The standard list of three-letter currency codes, such as `EUR` and `JPY`, with their minor units.                                                                     |
| issue                       | One reason a value was rejected: `{ message, path? }`.                                                                                                                 |
| JSON Schema                 | A JSON format for describing data, used by OpenAPI and many tools.                                                                                                     |
| level                       | One step in a line of types, such as `Integer` in `AnyNumber` › `FiniteNumber` › `Integer`.                                                                            |
| line of types               | A type with the types above and below it. Instances of one line compare with `equals()`. Siblings and variants are in other lines.                                     |
| minor units                 | How many digits an amount of a currency has after the decimal point: 2 for the euro (cents), 0 for the yen.                                                            |
| media type                  | The kind of content of a body or a file, such as `application/json`, sent in the `Content-Type` header. Also called a MIME type.                                       |
| morph                       | In ArkType, a step that turns the checked value into another value.                                                                                                    |
| nominal type                | A type told apart by its name, not its shape. `Email` and `Uuid` both wrap a string but don't mix.                                                                     |
| object schema               | What `objectOf()` returns: a schema for an object whose fields are checked by their own schemas.                                                                       |
| OpenAPI                     | A format that describes an HTTP API, read by tools such as Swagger UI. Its schemas are JSON Schema.                                                                    |
| ORM                         | Object-relational mapper: a library that maps database rows to objects, such as MikroORM or TypeORM.                                                                   |
| parent                      | The type a subtype was made from. `AnyString` is the parent of `Email`.                                                                                                |
| path                        | The part of an issue that says where the value was: field keys and array indexes, such as `['items', 0]`.                                                              |
| peer dependency             | A package you install yourself next to this one, such as `zod` for the Zod adapter. The core needs none.                                                               |
| pipe                        | In NestJS, a class that checks or converts an argument before the handler runs, such as `NominalPipe`.                                                                 |
| rule                        | What a valid value looks like: a regular expression, a type guard or a schema from another library.                                                                    |
| safe integer                | A whole number from `-(2^53 - 1)` to `2^53 - 1`. JavaScript numbers hold every one of them exactly; beyond that, digits can be lost.                                   |
| scalar                      | In GraphQL, a type for a single value, such as `String`. The GraphQL adapter makes one per nominal type.                                                               |
| schema                      | An object that checks values, such as a Zod schema or what `schemaOf()` returns.                                                                                       |
| `schemaOf()`                | Turns a type into a plain schema object, to build lists and optional values from: `schemaOf(Uuid).array()`.                                                            |
| sensitive type              | A type declared with `sensitive: true`. Its messages leave the rejected value out and tell only its kind, such as `a string of 7 characters`.                          |
| `serialize`                 | An option of the database adapters: a function that turns an instance into the value stored in the column. Without it, `toJSON()` is stored.                           |
| sibling                     | A type with the same parent as another, such as `Email` and `Uuid` under `AnyString`. A variant is a sibling of its source.                                            |
| `~standard`                 | The property through which a schema offers Standard Schema and Standard JSON Schema. Every nominal type has it.                                                        |
| Standard JSON Schema        | A shared interface for schemas that describe themselves as JSON Schema, part of [standardschema.dev](https://standardschema.dev).                                      |
| Standard Schema             | A shared interface for validators, [standardschema.dev](https://standardschema.dev). Zod, Valibot and ArkType support it, so they accept each other's schemas.         |
| `strict()`                  | The method of an object schema that refuses keys it doesn't declare instead of dropping them.                                                                          |
| subtype                     | A narrower type made with `subtype()`. It fits where its parent is expected, not the other way round.                                                                  |
| text form                   | How a type reads its value from a string, for `fromString()` and `fromEnv()`. Types under a base type have one; types made with `Nominal()` don't.                     |
| `trusted`                   | An option of the database adapters: `true` skips checking values read from the database.                                                                               |
| type guard                  | A function `(value: unknown) => value is T` that returns `true` for a valid value.                                                                                     |
| type name                   | The name given to `Nominal()`, such as `billing.InvoiceNumber`. It names the type in errors, JSON Schema and Swagger.                                                  |
| union                       | A value that may have one of several shapes, such as a payment by card or by bank transfer.                                                                            |
| value                       | What an instance wraps, read through `instance.value`: a string, number, bigint or boolean, or a frozen object or array.                                               |
| value object                | In domain-driven design, a value defined by its fields, such as a stay of guests and capacity. It is always valid, can't change, and compares by value.                |
| variant                     | A sibling type made with `variant()`. It has the methods of its source and a different rule, and the two don't mix.                                                    |

[← Reference](README.md)
