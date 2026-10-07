# @horizon-republic/nominal-types

[![Code checks](https://github.com/HorizonRepublic/nominal-types/actions/workflows/code-checks.yml/badge.svg?branch=main)](https://github.com/HorizonRepublic/nominal-types/actions/workflows/code-checks.yml)
[![npm](https://img.shields.io/npm/v/@horizon-republic/nominal-types)](https://www.npmjs.com/package/@horizon-republic/nominal-types)
[![License](https://img.shields.io/github/license/HorizonRepublic/nominal-types)](LICENSE)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Node](https://img.shields.io/badge/node-%E2%89%A522.12-339933)

Runtime-validated nominal types for TypeScript.

An email address, a UUID and a username are all `string` to the compiler. Nothing stops you from passing one where another is expected, and every function that receives one has to decide whether to check it again.

Here each of them is a class. You validate a value once, when it comes in, by constructing it. After that the compiler won't let you mix it up with other strings, and code that receives an `Email` knows it already holds a valid address.

A type also carries the code that works on its values. Instead of helpers scattered across a project that take a string and hope it is the right kind, `email.domain`, `email.withoutTag()` or `uuid.timestamp` live on the type, are found by autocompletion, and only ever run on a value that passed the rule.

Types work with any library that accepts [Standard Schema](https://standardschema.dev), and a NestJS pipe validates route parameters with them. The package has no runtime dependencies, and constructing an `Email` takes about 85 ns.

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

Any package manager works. The package ships ES modules and CommonJS side by side, each with its own type declarations, and runs on Node.js 22.12 or later. It has no runtime dependencies: the only package it lists, `@standard-schema/spec`, holds type definitions alone.

## Your first type

A nominal type is a class declared with `Nominal()`: a name, and what a valid value looks like.

```ts
import { Nominal } from '@horizon-republic/nominal-types';

export class OrderNumber extends Nominal('OrderNumber', /^ORD-\d{8}$/u) {}
```

Constructing it validates the value. A valid value becomes an instance:

```ts
const order = new OrderNumber('ORD-20261007');

order.value; // 'ORD-20261007'
```

An invalid one throws a `NominalError` that lists what is wrong:

```ts
new OrderNumber('42');
// NominalError: OrderNumber: must be matched by ^ORD-\d{8}$ (was "42")
```

A function that takes an `OrderNumber` can rely on it being valid. The compiler won't accept a plain string there, or another nominal type that also wraps a string:

```ts
const ship = (order: OrderNumber): string => `shipping ${order.value}`;

ship(order); // fine
ship('ORD-20261007'); // compile error
```

JSON and template strings get the bare value:

```ts
JSON.stringify({ order }); // '{"order":"ORD-20261007"}'
`${order}`; // 'ORD-20261007'
```

## Documentation

**Guides**

- [Declaring types](docs/guides/declaring-types.md): patterns, type guards, schemas from validation libraries, and behaviour on the type.
- [Building on a type](docs/guides/building-on-types.md): `subtype()`, `extends` and `variant()`, moving values between types, and ordering rules.
- [Validating untrusted input](docs/guides/validating-input.md): `parse()` and `is()` where bad input is expected.
- [Embedding types in other validators](docs/guides/other-validators.md): nominal types inside ArkType, Zod and other schemas.
- [Generating JSON Schema](docs/guides/json-schema.md): describing types to OpenAPI and documentation tools.
- [NestJS](docs/guides/nestjs.md): validating route parameters with `NominalPipe`.

**Reference**

- [Built-in types](docs/reference/built-in-types.md): `Email`, `Uuid`, `Url` and `HttpUrl`.
- [API](docs/reference/api.md): every function, member and type the package exports.

**Explanation**

- [How it works](docs/explanation/how-it-works.md): why classes, validating once, nominal typing and identity across copies.
- [Performance](docs/explanation/performance.md): what each operation costs.

## Contributing

The repository keeps `package-lock.json`, and `.node-version` names the Node.js release the checks run on. A pull request that adds or changes public behaviour updates this README in the same change.

| Script              | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run build`     | Builds both formats into `dist` and checks how the package resolves |
| `npm run typecheck` | Runs the TypeScript compiler without emitting                       |
| `npm run lint`      | Runs oxlint with type-aware rules                                   |
| `npm run format`    | Formats the tree with oxfmt; `format:check` only reports            |
| `npm test`          | Runs the vitest suites; `test:coverage` adds a coverage report      |

## License

Licensed under the terms in [LICENSE](LICENSE).
