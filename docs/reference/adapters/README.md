# Adapters

An [adapter](../glossary.md) connects nominal types to another library. Each adapter is a separate [entry point](../glossary.md): `@horizon-republic/nominal-types/adapters/<name>`.

The other library is an optional [peer dependency](../glossary.md). Install it only if you import its adapter. Nothing from it loads otherwise.

| Entry point                           | Exports                                               | Peer package and versions                                        | Guide                                                         |
| ------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| [arktype](arktype.md)                 | `toArk()`, `fromArk()`, `constrainArk()`, `ArkSchema` | `arktype` ^2.2.0                                                 | [ArkType](../../guides/validators/arktype.md)                 |
| [zod](zod.md)                         | `toZod()`, `constrainZod()`                           | `zod` ^4.0.0                                                     | [Zod](../../guides/validators/zod.md)                         |
| [valibot](valibot.md)                 | `toValibot()`, `constrainValibot()`                   | `valibot` ^1.0.0                                                 | [Valibot](../../guides/validators/valibot.md)                 |
| [class-validator](class-validator.md) | `@NominalField()`                                     | `class-validator` ^0.14.0 or ^0.15.0, `class-transformer` ^0.5.1 | [class-validator](../../guides/validators/class-validator.md) |
| [nest](nest.md)                       | `NominalPipe`                                         | `@nestjs/common` ^11.0.0 or ^12.0.0                              | [NestJS](../../guides/frameworks/nestjs.md)                   |
| [swagger](swagger.md)                 | `applyNominalTypes()`, `@ApiNominalProperty()`        | `@nestjs/swagger` ^11.0.0 or ^12.0.0                             | [Swagger](../../guides/api-docs/swagger.md)                   |
| [graphql](graphql.md)                 | `toGraphQL()`                                         | `graphql` ^16.0.0 or ^17.0.0                                     | [GraphQL](../../guides/frameworks/graphql.md)                 |
| [superjson](superjson.md)             | `toSuperjson()`                                       | none: the adapter doesn't import superjson                       | [superjson](../../guides/frameworks/superjson.md)             |
| [mikro-orm](mikro-orm.md)             | `toMikroOrm()`                                        | `@mikro-orm/core` ^7.0.0                                         | [MikroORM](../../guides/databases/mikro-orm.md)               |
| [typeorm](typeorm.md)                 | `toTypeOrm()`                                         | `typeorm` ^0.3.13 or ^1.0.0                                      | [TypeORM](../../guides/databases/typeorm.md)                  |
| [drizzle](drizzle.md)                 | `toDrizzle()`                                         | none: you pass the result to Drizzle's `customType`              | [Drizzle](../../guides/databases/drizzle.md)                  |
| [sequelize](sequelize.md)             | `toSequelize()`                                       | `sequelize` ^6.0.0                                               | [Sequelize](../../guides/databases/sequelize.md)              |

The four database adapters share one set of rules for columns, reads and writes: see [Database columns](database-columns.md).

Every entry point works with `import` and `require`, on Node.js 22.12 or later.

## Names

| Prefix       | Does                                                           | Example                      |
| ------------ | -------------------------------------------------------------- | ---------------------------- |
| `to…`        | turns a nominal type into the other library's piece            | `toZod(Email)`               |
| `constrain…` | attaches [constraints](../schemas.md) to that library's object | `constrainZod(object, rule)` |
| `fromArk`    | turns an ArkType schema into one that gives instances          | `fromArk(type({ … }))`       |

## No adapter needed

Any library that reads [Standard Schema](../glossary.md) takes a nominal type or an `n.of()` schema as it is. See [How to use a type inside any Standard Schema library](../../guides/validators/standard-schema.md).

[← Reference](../README.md)
