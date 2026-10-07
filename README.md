# @horizon-republic/nominal-types

[![Code checks](https://github.com/HorizonRepublic/nominal-types/actions/workflows/code-checks.yml/badge.svg?branch=main)](https://github.com/HorizonRepublic/nominal-types/actions/workflows/code-checks.yml)
[![npm](https://img.shields.io/npm/v/@horizon-republic/nominal-types)](https://www.npmjs.com/package/@horizon-republic/nominal-types)
[![License](https://img.shields.io/github/license/HorizonRepublic/nominal-types)](LICENSE)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Node](https://img.shields.io/badge/node-%E2%89%A522.12-339933)

Runtime-validated nominal types for TypeScript.

To TypeScript, an email address is just a `string`. Nothing stops you from passing a user ID where an email is expected, or a string that was never checked.

This package turns such values into small classes:

- `new Email(text)` checks the text once. Every `Email` you hold is valid.
- An `Email` can't be passed where a `Uuid` or a plain `string` is expected.
- Helpers live on the type: `email.domain`, `uuid.timestamp`.
- A rule is a regular expression, or a schema from Zod, Valibot, ArkType or another [Standard Schema](https://standardschema.dev) library.

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

## Built-in types

Each group starts from a base type. Using them is optional.

| Group        | Types                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Strings      | `AnyString`, `Email`, `Uuid`, `Url`, `HttpUrl`                                                                                         |
| Numbers      | `AnyNumber`, `FiniteNumber`, `Integer`, `Float32`, positive / negative / non-negative / non-positive, `Int8`–`Int32`, `Uint8`–`Uint32` |
| Big integers | `AnyBigInt`, positive / negative / non-negative / non-positive, `Int64`, `Uint64`                                                      |
| Booleans     | `AnyBoolean`                                                                                                                           |

See [Built-in types](docs/reference/types/README.md) for each one.

## Supported libraries

Validation libraries:

| Library                                                             | As a type's rule         | A nominal type inside its schemas |
| ------------------------------------------------------------------- | ------------------------ | --------------------------------- |
| [ArkType](https://arktype.io)                                       | yes, with JSON Schema    | yes, with `schemaOf(Type)`        |
| [Zod](https://zod.dev) 4                                            | yes, with JSON Schema    | no                                |
| [Valibot](https://valibot.dev)                                      | yes, without JSON Schema | no                                |
| any other synchronous [Standard Schema](https://standardschema.dev) | yes                      | depends on the library            |

Frameworks and DTO libraries:

| Integration     | How                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| NestJS 11, 12   | `NominalPipe` from `@horizon-republic/nominal-types/adapters/nest`, see the [guide](docs/guides/nestjs.md)                                         |
| NestJS 12       | Nest's own `StandardSchemaValidationPipe` with `{ schema: Type }`                                                                                  |
| class-validator | `@NominalField()` from `@horizon-republic/nominal-types/adapters/class-validator`, see the [guide](docs/guides/class-validator.md)                 |
| @nestjs/swagger | `applyNominalTypes()` and `@ApiNominalProperty()` from `@horizon-republic/nominal-types/adapters/swagger`, see the [guide](docs/guides/swagger.md) |

Adapters are separate entry points of this one package, such as `@horizon-republic/nominal-types/adapters/nest`. Their libraries are optional peer dependencies: nothing from NestJS, class-validator or Swagger is installed or loaded unless you import the adapter.

## Documentation

- [Tutorial](docs/tutorials/your-first-type.md): build your first type step by step.
- [Guides](docs/guides/README.md): recipes for common tasks.
- [Reference](docs/reference/README.md): every export and built-in type.
- [Explanation](docs/explanation/README.md): why it works the way it does.

## Contributing

The repository keeps `package-lock.json`, and `.node-version` names the Node.js release the checks run on. A pull request that adds or changes public behaviour updates this README in the same change.

| Script                   | What it does                                                        |
| ------------------------ | ------------------------------------------------------------------- |
| `npm run build`          | Builds both formats into `dist` and checks how the package resolves |
| `npm run typecheck`      | Runs the TypeScript compiler without emitting                       |
| `npm run lint`           | Runs oxlint with type-aware rules                                   |
| `npm run format`         | Formats the tree with oxfmt; `format:check` only reports            |
| `npm test`               | Runs the vitest suites; `test:coverage` adds a coverage report      |
| `npm run bench`          | Compares the speed of nominal-types with nine other libraries       |
| `npm run bench:document` | Validates a 2.9 MB document with seven setups                       |

## License

Licensed under the terms in [LICENSE](LICENSE).
