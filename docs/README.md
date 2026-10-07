# Documentation

New here? Start with the [tutorial](tutorials/README.md). It builds a sign-up check step by step, and every lesson ends with code that runs.

## [Tutorial](tutorials/README.md)

1. [Your first type](tutorials/01-first-type.md)
2. [Use a built-in type](tutorials/02-built-in-types.md)
3. [Add behaviour to a type](tutorials/03-add-behaviour.md)
4. [Check input without exceptions](tutorials/04-check-input.md)
5. [Check a whole form](tutorials/05-check-a-form.md)
6. [Check fields against each other](tutorials/06-fields-together.md)
7. [Answer an HTTP request](tutorials/07-serve-it.md)

## [Guides](guides/README.md)

Core:

- [How to declare a type](guides/core/declare-a-type.md)
- [How to make a stricter type or a variant](guides/core/build-on-a-type.md)
- [How to check untrusted input](guides/core/check-input.md)
- [How to check a request body with objectOf()](guides/core/check-an-object.md)
- [How to accept lists, missing values and null](guides/core/lists-and-optional-values.md)
- [How to check one field against another](guides/core/check-fields-together.md)
- [How to make a value object](guides/core/make-a-value-object.md)
- [How to read numbers and booleans from text](guides/core/read-text-values.md)
- [How to read configuration from environment variables](guides/core/read-config.md)
- [How to keep values out of error messages](guides/core/hide-values.md)
- [How to test code that takes nominal types](guides/core/write-tests.md)
- [How to fix common problems](guides/core/fix-common-problems.md)

Validators:

- [How to use nominal types with ArkType](guides/validators/arktype.md)
- [How to use nominal types with Zod](guides/validators/zod.md)
- [How to use nominal types with Valibot](guides/validators/valibot.md)
- [How to use nominal types with class-validator](guides/validators/class-validator.md)
- [How to use a type in any Standard Schema library](guides/validators/standard-schema.md)

Frameworks:

- [How to use nominal types with NestJS](guides/frameworks/nestjs.md)
- [How to use nominal types with GraphQL](guides/frameworks/graphql.md)
- [How to send nominal types through superjson](guides/frameworks/superjson.md)

Databases:

- [How to store nominal types with MikroORM](guides/databases/mikro-orm.md)
- [How to store nominal types with TypeORM](guides/databases/typeorm.md)
- [How to store nominal types with Drizzle](guides/databases/drizzle.md)
- [How to store nominal types with Sequelize](guides/databases/sequelize.md)

API docs:

- [How to document nominal types in Swagger](guides/api-docs/swagger.md)
- [How to get a JSON Schema for a type](guides/api-docs/json-schema.md)

## [Reference](reference/README.md)

- [Declaring types](reference/declaring.md)
- [Type members](reference/type-members.md)
- [Schemas](reference/schemas.md)
- [Errors and messages](reference/errors-and-messages.md)
- [JSON Schema](reference/json-schema.md)
- [TypeScript types](reference/typescript-types.md)
- [Built-in types](reference/types/README.md)
- [Adapters](reference/adapters/README.md)
- [Database columns](reference/adapters/database-columns.md)
- [Benchmarks](reference/benchmarks.md)
- [Glossary](reference/glossary.md)

## [Explanation](explanation/README.md)

- [What a nominal type is](explanation/nominal-types.md)
- [Type hierarchy](explanation/type-hierarchy.md)
- [Where checks belong](explanation/where-checks-belong.md)
- [Choosing how to check input](explanation/choosing-an-approach.md)
- [Performance](explanation/performance.md)
- [Nominal types in domain-driven design](explanation/domain-driven-design.md)

[← Project README](../README.md)
