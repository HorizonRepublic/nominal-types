# Reference

Exact facts about everything the package exports, for looking things up. Terms are explained in the [glossary](glossary.md).

## Core

| Page                                          | What's in it                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Declaring types](declaring.md)               | `Nominal()`, `subtype()`, `variant()`, `matching()`, `satisfying()`, type names    |
| [Type members](type-members.md)               | `new`, `parse()`, `instanceof`, `value`, `equals()`, `toJSON()`, `copyWith()`      |
| [Schemas](schemas.md)                         | `schemaOf()`, `array()`, `fromString()`, `objectOf()`, `fromEnv()`, `constraint()` |
| [Errors and messages](errors-and-messages.md) | `NominalError`, issues, message text, sensitive types, `hideValues()`              |
| [JSON Schema](json-schema.md)                 | Targets, `input()` and `output()`, what each schema is described as                |
| [TypeScript types](typescript-types.md)       | Every exported type, such as `ValueOf`, `InputOf` and `Parsed`                     |

## Built-in types

| Page                              | Types                                          |
| --------------------------------- | ---------------------------------------------- |
| [Built-in types](types/README.md) | The type tree, and which type to pick          |
| [Strings](types/string.md)        | `AnyString`, `Email`, `Uuid`, `Url`, `HttpUrl` |
| [Numbers](types/number.md)        | `AnyNumber` and the 17 types under it          |
| [Big integers](types/bigint.md)   | `AnyBigInt`, its sign types, `Int64`, `Uint64` |
| [Booleans](types/boolean.md)      | `AnyBoolean`                                   |

## Adapters

| Page                                             | Entry point                                                  |
| ------------------------------------------------ | ------------------------------------------------------------ |
| [Adapters](adapters/README.md)                   | All entry points and their peer packages                     |
| [ArkType](adapters/arktype.md)                   | `adapters/arktype`                                           |
| [Zod](adapters/zod.md)                           | `adapters/zod`                                               |
| [Valibot](adapters/valibot.md)                   | `adapters/valibot`                                           |
| [class-validator](adapters/class-validator.md)   | `adapters/class-validator`                                   |
| [NestJS](adapters/nest.md)                       | `adapters/nest`                                              |
| [Swagger](adapters/swagger.md)                   | `adapters/swagger`                                           |
| [GraphQL](adapters/graphql.md)                   | `adapters/graphql`                                           |
| [superjson](adapters/superjson.md)               | `adapters/superjson`                                         |
| [MikroORM](adapters/mikro-orm.md)                | `adapters/mikro-orm`                                         |
| [TypeORM](adapters/typeorm.md)                   | `adapters/typeorm`                                           |
| [Drizzle](adapters/drizzle.md)                   | `adapters/drizzle`                                           |
| [Sequelize](adapters/sequelize.md)               | `adapters/sequelize`                                         |
| [Database columns](adapters/database-columns.md) | The column of each type, reads and writes, for all four ORMs |

## Other

| Page                        | What's in it                                    |
| --------------------------- | ----------------------------------------------- |
| [Benchmarks](benchmarks.md) | Every benchmark number, and how it was measured |
| [Glossary](glossary.md)     | The terms these pages use                       |

[← Documentation](../README.md)
