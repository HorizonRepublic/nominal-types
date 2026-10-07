# @horizon-republic/nominal-types

[![Code checks](https://github.com/HorizonRepublic/nominal-types/actions/workflows/code-checks.yml/badge.svg?branch=main)](https://github.com/HorizonRepublic/nominal-types/actions/workflows/code-checks.yml)
[![npm](https://img.shields.io/npm/v/@horizon-republic/nominal-types)](https://www.npmjs.com/package/@horizon-republic/nominal-types)
[![License](https://img.shields.io/github/license/HorizonRepublic/nominal-types)](LICENSE)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Node](https://img.shields.io/badge/node-%E2%89%A522.12-339933)

Runtime-validated nominal types for TypeScript, for the validators and frameworks you already use.

To TypeScript, an email address is just a `string`. Nothing stops you from passing a user ID where an email is expected, or a string that was never checked.

This package turns such values into small classes:

- `new Email(text)` checks the text once. Every `Email` you hold is valid.
- An `Email` can't be passed where a `Uuid` or a plain `string` is expected.
- Helpers live on the type: `email.domain`, `uuid.timestamp`.
- The same types work across your stack: ArkType, NestJS, class-validator, Swagger and any [Standard Schema](https://standardschema.dev) library. See [Supported libraries](#supported-libraries).

## Example

```ts
import { Email, Uuid } from '@horizon-republic/nominal-types';

const sendInvite = (to: Email, team: Uuid): void => {
  // `to` is a valid address and `team` a valid UUID: nothing to check here
};

const team = new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');

sendInvite(new Email('jane+invites@example.com'), team);
sendInvite('jane@example.com', team); // compile error: a string is not an Email
new Email('not an address'); // throws NominalError
```

> `main` holds version 3, which has not been published yet. Version 2 stays on npm:
> `npm install @horizon-republic/nominal-types@2`.

## Installation

```shell
npm install @horizon-republic/nominal-types
```

It works with both `import` and `require`, on Node.js 22.12 or later.

## Supported libraries

A nominal type works with other libraries in three ways: as a library's field type, as a rule written with that library, or through an adapter, a separate entry point of this package.

| Library                                                         | Fields of its schemas                                                     | Rules for a type      | Guide                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------- | --------------------------------------------------- |
| [ArkType](https://arktype.io)                                   | yes, with the adapter `toArk()`, at ArkType's speed                       | yes, with JSON Schema | [ArkType](docs/guides/arktype.md)                   |
| [NestJS](https://nestjs.com) 11, 12                             | parameters, bodies and message payloads, with the adapter `NominalPipe`   | —                     | [NestJS](docs/guides/nestjs.md)                     |
| [class-validator](https://github.com/typestack/class-validator) | DTO properties, with the adapter `@NominalField()`                        | —                     | [class-validator](docs/guides/class-validator.md)   |
| [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction) | full schemas in the document, with the adapter `applyNominalTypes()`      | —                     | [Swagger](docs/guides/swagger.md)                   |
| [GraphQL](https://graphql.org) 16, 17                           | scalars that give instances, with the adapter `toGraphQL()`               | —                     | [GraphQL](docs/guides/graphql.md)                   |
| [superjson](https://github.com/flightcontrolhq/superjson)       | instances that survive tRPC and Next.js, with the adapter `toSuperjson()` | —                     | [superjson](docs/guides/superjson.md)               |
| [Zod](https://zod.dev) 4                                        | yes, with the adapter `toZod()`                                           | yes, with JSON Schema | [Zod](docs/guides/zod.md)                           |
| [Valibot](https://valibot.dev)                                  | yes, with the adapter `toValibot()`                                       | yes, no JSON Schema   | [Valibot](docs/guides/valibot.md)                   |
| any [Standard Schema](https://standardschema.dev) consumer      | yes, the type itself or `schemaOf(Type)`, such as NestJS 12 `{ schema }`  | yes                   | [Other validators](docs/guides/other-validators.md) |

Databases:

| ORM                                  | How                                                               | Guide                                 |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------- |
| [MikroORM](https://mikro-orm.io) 7   | entity properties hold instances, with the adapter `toMikroOrm()` | [MikroORM](docs/guides/mikro-orm.md)  |
| [TypeORM](https://typeorm.io)        | entity columns hold instances, with the adapter `toTypeOrm()`     | [TypeORM](docs/guides/typeorm.md)     |
| [Drizzle](https://orm.drizzle.team)  | table columns hold instances, with the adapter `toDrizzle()`      | [Drizzle](docs/guides/drizzle.md)     |
| [Sequelize](https://sequelize.org) 6 | model attributes hold instances, with the adapter `toSequelize()` | [Sequelize](docs/guides/sequelize.md) |

Values read from the database are checked, and the column type comes from the nominal type.

Adapters are entry points such as `@horizon-republic/nominal-types/adapters/arktype`. Their libraries are optional peer dependencies: nothing from ArkType, Zod, Valibot, NestJS, class-validator, Swagger, GraphQL, MikroORM, TypeORM or Sequelize is installed or loaded unless you import the adapter.

## Concepts

### A type is a class with a rule

```ts
import { Nominal } from '@horizon-republic/nominal-types';

export class OrderNumber extends Nominal('OrderNumber', /^ORD-\d{8}$/u) {}
```

The rule here is a regular expression: `ORD-` and eight digits. It can also be a type guard or a schema from another library.

### Every instance is valid

`new` checks the value and throws if it is wrong. `parse()` returns a result instead, for input that may be wrong:

```ts
new OrderNumber('ORD-20261007').value; // 'ORD-20261007'
new OrderNumber('42'); // throws NominalError: OrderNumber: must be matched by ^ORD-\d{8}$ (was "42")

OrderNumber.parse('42'); // { ok: false, issues: [{ message: 'must be matched by …' }] }
```

### Types don't mix

The compiler keeps every type apart, even when two types wrap the same kind of value:

```ts
const ship = (order: OrderNumber): void => {};

ship(new OrderNumber('ORD-20261007')); // fine
ship('ORD-20261007'); // compile error
```

### Methods live on the type

Add getters and methods to the class. They always work on a valid value:

```ts
export class OrderNumber extends Nominal('OrderNumber', /^ORD-\d{8}$/u) {
  get year(): number {
    return Number(this.value.slice(4, 8));
  }
}
```

### Types build on each other

A subtype adds a rule and fits wherever its parent is expected:

```ts
export class ExpressOrderNumber extends OrderNumber.subtype('ExpressOrderNumber', /^ORD-\d{4}9/u) {}
```

### Objects are checked field by field

`objectOf()` checks an object of nominal fields, with no other library, as fast as Zod gives plain values:

```ts
import { Email, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

export const CreateOrder = objectOf({ email: Email, quantity: PositiveInteger });

CreateOrder.parse(body); // { ok: true, value: { email: Email, quantity: PositiveInteger } }
```

### Rules can span fields

A constraint checks fields of an object against each other, like a `CHECK` constraint in SQL:

```ts
import { constraint, PositiveInteger } from '@horizon-republic/nominal-types';

export const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);
```

## Built-in types

Each group starts from a base type. Using them is optional.

| Group        | Types                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Strings      | `AnyString`, `Email`, `Uuid`, `Url`, `HttpUrl`                                                                                         |
| Numbers      | `AnyNumber`, `FiniteNumber`, `Integer`, `Float32`, positive / negative / non-negative / non-positive, `Int8`–`Int32`, `Uint8`–`Uint32` |
| Big integers | `AnyBigInt`, positive / negative / non-negative / non-positive, `Int64`, `Uint64`                                                      |
| Booleans     | `AnyBoolean`                                                                                                                           |

See [Built-in types](docs/reference/types/README.md) for each one.

## Documentation

- [Tutorial](docs/tutorials/your-first-type.md): build your first type step by step.
- [Guides](docs/guides/README.md): recipes for common tasks.
- [Reference](docs/reference/README.md): every export and built-in type.
- [Explanation](docs/explanation/README.md): why it works the way it does.

## Contributing

The repository keeps `package-lock.json`, and `.node-version` names the Node.js release the checks run on. A pull request that adds or changes public behaviour updates this README in the same change.

| Script                              | What it does                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `npm run build`                     | Builds both formats into `dist` and checks how the package resolves            |
| `npm run typecheck`                 | Runs the TypeScript compiler without emitting                                  |
| `npm run lint`                      | Runs oxlint with type-aware rules                                              |
| `npm run format`                    | Formats the tree with oxfmt; `format:check` only reports                       |
| `npm test`                          | Runs the vitest suites; `test:coverage` adds a coverage report                 |
| `npm run bench`                     | Compares the speed of nominal-types with nine other libraries                  |
| `npm run bench:document`            | Validates a 3 MB document with eight setups                                    |
| `npm run profile:cpu -- <script>`   | Profiles a script and lists where the time goes, by place and function         |
| `npm run profile:deopt -- <script>` | Lists the functions of this package V8 optimised and deoptimised, with reasons |

## License

Licensed under the terms in [LICENSE](LICENSE).
