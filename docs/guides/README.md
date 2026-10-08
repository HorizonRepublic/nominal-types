# Guides

Each guide shows how to do one task. Find your task in the "I want to…" column. New to the package? Take the [tutorial](../tutorials/README.md) first.

## Core

Your own types, and checking input with no other library.

| I want to…                                    | Guide                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| declare a type of my own                      | [How to declare a type](core/declare-a-type.md)                                   |
| make a stricter type or a variant of a type   | [How to make a stricter type or a variant](core/build-on-a-type.md)               |
| check a value I don't trust                   | [How to check untrusted input](core/check-input.md)                               |
| check a request body                          | [How to check a request body with n.object()](core/check-an-object.md)            |
| accept a list, a missing value or `null`      | [How to accept lists, missing values and null](core/lists-and-optional-values.md) |
| check one field against another               | [How to check one field against another](core/check-fields-together.md)           |
| make a value object of several fields         | [How to make a value object](core/make-a-value-object.md)                         |
| read numbers and booleans from strings        | [How to read numbers and booleans from text](core/read-text-values.md)            |
| check dates and times                         | [How to use dates and times](core/use-dates-and-times.md)                         |
| read configuration from environment variables | [How to read configuration from environment variables](core/read-config.md)       |
| keep values out of error messages             | [How to keep values out of error messages](core/hide-values.md)                   |
| test code that takes nominal types            | [How to test code that takes nominal types](core/write-tests.md)                  |
| fix an error or a surprise                    | [How to fix common problems](core/fix-common-problems.md)                         |

## Validators

You already use a validation library. New project? Check bodies with [n.object()](core/check-an-object.md) instead.

| I want to…                                      | Guide                                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| use nominal types in ArkType schemas            | [How to use nominal types with ArkType](validators/arktype.md)                    |
| use nominal types in Zod schemas                | [How to use nominal types with Zod](validators/zod.md)                            |
| use nominal types in Valibot schemas            | [How to use nominal types with Valibot](validators/valibot.md)                    |
| use nominal types in class-validator DTOs       | [How to use nominal types with class-validator](validators/class-validator.md)    |
| use a type in any other Standard Schema library | [How to use a type in any Standard Schema library](validators/standard-schema.md) |

## Frameworks

| I want to…                                   | Guide                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| check NestJS parameters, bodies and payloads | [How to use nominal types with NestJS](frameworks/nestjs.md)           |
| take nominal types as GraphQL arguments      | [How to use nominal types with GraphQL](frameworks/graphql.md)         |
| keep instances through tRPC or Next.js       | [How to send nominal types through superjson](frameworks/superjson.md) |

## Databases

| I want to…                         | Guide                                                               |
| ---------------------------------- | ------------------------------------------------------------------- |
| store nominal types with MikroORM  | [How to store nominal types with MikroORM](databases/mikro-orm.md)  |
| store nominal types with TypeORM   | [How to store nominal types with TypeORM](databases/typeorm.md)     |
| store nominal types with Drizzle   | [How to store nominal types with Drizzle](databases/drizzle.md)     |
| store nominal types with Sequelize | [How to store nominal types with Sequelize](databases/sequelize.md) |

## API docs

| I want to…                                   | Guide                                                           |
| -------------------------------------------- | --------------------------------------------------------------- |
| describe nominal types in a Swagger document | [How to document nominal types in Swagger](api-docs/swagger.md) |
| get a JSON Schema for a type                 | [How to get a JSON Schema for a type](api-docs/json-schema.md)  |

[← Documentation](../README.md)
