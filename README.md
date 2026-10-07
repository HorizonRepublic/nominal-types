# @horizon-republic/nominal-types

[![Code checks](https://github.com/HorizonRepublic/nominal-types/actions/workflows/code-checks.yml/badge.svg?branch=main)](https://github.com/HorizonRepublic/nominal-types/actions/workflows/code-checks.yml)
[![npm](https://img.shields.io/npm/v/@horizon-republic/nominal-types)](https://www.npmjs.com/package/@horizon-republic/nominal-types)
[![License](https://img.shields.io/github/license/HorizonRepublic/nominal-types)](LICENSE)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Node](https://img.shields.io/badge/node-%E2%89%A522.12-339933)

Runtime-validated nominal types for TypeScript.

A string that holds an email address is still just a `string` to the compiler. This package turns such values into classes that check them once, when they come in:

- an `Email` you receive is always a valid address, with no need to check it again;
- an `Email` can't be passed where a `Uuid` or a plain `string` is expected;
- the code that works on a value lives on its type, as `email.domain` or `uuid.timestamp`;
- a type is defined with a regular expression or with a schema from Zod, Valibot, ArkType or any other [Standard Schema](https://standardschema.dev) library.

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

It ships ES modules and CommonJS and runs on Node.js 22.12 or later.

## Your first type

A nominal type is a class with a name and a rule for what a valid value looks like. Most start under one of the [built-in types](docs/reference/types/README.md):

```ts
import { AnyString } from '@horizon-republic/nominal-types';

export class OrderNumber extends AnyString.subtype('OrderNumber', /^ORD-\d{8}$/u) {}
```

Constructing it validates the value. A valid value becomes an instance:

```ts
const order = new OrderNumber('ORD-20261007');

order.value; // 'ORD-20261007'
```

An invalid one throws a `NominalError` that says what is wrong:

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

[Your first type](docs/tutorials/your-first-type.md) continues from here: behaviour on the type, checking untrusted input and a narrower type.

## Documentation

### Tutorials

Lessons that take you from nothing to a working result.

- [Your first type](docs/tutorials/your-first-type.md)
  - [Set up a project](docs/tutorials/your-first-type.md#set-up-a-project)
  - [Declare the type](docs/tutorials/your-first-type.md#declare-the-type)
  - [Build a value](docs/tutorials/your-first-type.md#build-a-value)
  - [Try an invalid value](docs/tutorials/your-first-type.md#try-an-invalid-value)
  - [Let the compiler keep it apart](docs/tutorials/your-first-type.md#let-the-compiler-keep-it-apart)
  - [Give it behaviour](docs/tutorials/your-first-type.md#give-it-behaviour)
  - [Check input that may be wrong](docs/tutorials/your-first-type.md#check-input-that-may-be-wrong)
  - [Add a narrower type](docs/tutorials/your-first-type.md#add-a-narrower-type)
  - [What we built](docs/tutorials/your-first-type.md#what-we-built)

### How-to guides

Recipes for a task you already have in mind.

- [How to declare a type](docs/guides/declaring-types.md)
  - [Declaring with a pattern](docs/guides/declaring-types.md#declaring-with-a-pattern)
  - [Declaring with a type guard](docs/guides/declaring-types.md#declaring-with-a-type-guard)
  - [Declaring with a schema from another library](docs/guides/declaring-types.md#declaring-with-a-schema-from-another-library)
  - [Giving the type behaviour](docs/guides/declaring-types.md#giving-the-type-behaviour)
- [How to build on a type](docs/guides/building-on-types.md)
  - [Choosing how](docs/guides/building-on-types.md#choosing-how)
  - [Starting from a base type](docs/guides/building-on-types.md#starting-from-a-base-type)
  - [Adding a stricter rule](docs/guides/building-on-types.md#adding-a-stricter-rule)
  - [Giving a type a second name](docs/guides/building-on-types.md#giving-a-type-a-second-name)
  - [Adding behaviour without a new type](docs/guides/building-on-types.md#adding-behaviour-without-a-new-type)
  - [Accepting different values with the same behaviour](docs/guides/building-on-types.md#accepting-different-values-with-the-same-behaviour)
  - [Moving a value between types](docs/guides/building-on-types.md#moving-a-value-between-types)
  - [Ordering the rules](docs/guides/building-on-types.md#ordering-the-rules)
- [How to validate untrusted input](docs/guides/validating-input.md)
- [How to use a type inside another validator](docs/guides/other-validators.md)
- [How to generate JSON Schema](docs/guides/json-schema.md)
  - [Getting a type's schema](docs/guides/json-schema.md#getting-a-types-schema)
  - [Making your own type describable](docs/guides/json-schema.md#making-your-own-type-describable)
  - [Keeping the schema and the type in step](docs/guides/json-schema.md#keeping-the-schema-and-the-type-in-step)
- [How to validate NestJS route parameters](docs/guides/nestjs.md)
  - [Validating every parameter](docs/guides/nestjs.md#validating-every-parameter)
  - [Validating one parameter](docs/guides/nestjs.md#validating-one-parameter)
  - [Shaping the error response](docs/guides/nestjs.md#shaping-the-error-response)
  - [Validating headers](docs/guides/nestjs.md#validating-headers)

### Reference

What every export and built-in type does, in full.

- [API](docs/reference/api.md)
  - [Functions](docs/reference/api.md#functions)
  - [Static members](docs/reference/api.md#static-members)
  - [Instance members](docs/reference/api.md#instance-members)
  - [NominalError](docs/reference/api.md#nominalerror)
  - [Messages](docs/reference/api.md#messages)
  - [JSON Schema](docs/reference/api.md#json-schema)
  - [Types](docs/reference/api.md#types)
- [Built-in types](docs/reference/types/README.md)
  - [Strings](docs/reference/types/string.md)
    - [AnyString](docs/reference/types/string.md#anystring)
    - [Email](docs/reference/types/string.md#email)
    - [Uuid](docs/reference/types/string.md#uuid)
    - [Url](docs/reference/types/string.md#url)
    - [HttpUrl](docs/reference/types/string.md#httpurl)
  - [Numbers](docs/reference/types/number.md)
    - [AnyNumber](docs/reference/types/number.md#anynumber)
    - [FiniteNumber](docs/reference/types/number.md#finitenumber)
    - [Sign types](docs/reference/types/number.md#sign-types)
    - [Integer](docs/reference/types/number.md#integer)
    - [Sized integers](docs/reference/types/number.md#sized-integers)
    - [Float32](docs/reference/types/number.md#float32)
  - [Big integers](docs/reference/types/bigint.md)
    - [AnyBigInt](docs/reference/types/bigint.md#anybigint)
    - [Sign types](docs/reference/types/bigint.md#sign-types)
    - [Int64 and Uint64](docs/reference/types/bigint.md#int64-and-uint64)
  - [Booleans](docs/reference/types/boolean.md)
    - [AnyBoolean](docs/reference/types/boolean.md#anyboolean)

### Explanation

Why the package works the way it does.

- [How it works](docs/explanation/how-it-works.md)
  - [Classes rather than brands](docs/explanation/how-it-works.md#classes-rather-than-brands)
  - [Behaviour on the type](docs/explanation/how-it-works.md#behaviour-on-the-type)
  - [Validated once](docs/explanation/how-it-works.md#validated-once)
  - [Nominal at compile time](docs/explanation/how-it-works.md#nominal-at-compile-time)
  - [One identity across copies](docs/explanation/how-it-works.md#one-identity-across-copies)
- [Type hierarchy](docs/explanation/type-hierarchy.md)
  - [Why base types](docs/explanation/type-hierarchy.md#why-base-types)
  - [Why three ways to build on a type](docs/explanation/type-hierarchy.md#why-three-ways-to-build-on-a-type)
  - [Why limits are new types](docs/explanation/type-hierarchy.md#why-limits-are-new-types)
  - [Why zero splits the sign types](docs/explanation/type-hierarchy.md#why-zero-splits-the-sign-types)
  - [Why big integers travel as strings](docs/explanation/type-hierarchy.md#why-big-integers-travel-as-strings)
- [Performance](docs/explanation/performance.md)
  - [Measurements](docs/explanation/performance.md#measurements)
  - [How a chain runs](docs/explanation/performance.md#how-a-chain-runs)

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
