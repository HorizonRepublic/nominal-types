# @horizon-republic/nominal-types

[![Code checks](https://github.com/HorizonRepublic/nominal-types/actions/workflows/code-checks.yml/badge.svg?branch=main)](https://github.com/HorizonRepublic/nominal-types/actions/workflows/code-checks.yml)
[![npm](https://img.shields.io/npm/v/@horizon-republic/nominal-types)](https://www.npmjs.com/package/@horizon-republic/nominal-types)
[![License](https://img.shields.io/github/license/HorizonRepublic/nominal-types)](LICENSE)
![Runtime dependencies](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)
![Node](https://img.shields.io/badge/node-%E2%89%A522.12-339933)

Runtime-validated nominal types for TypeScript, for the validators and frameworks you already use.

## The problem

To TypeScript, an email address and a team ID are both `string`. Swap them, and the code still compiles:

```ts
const sendInvite = (to: string, team: string): void => {
  console.log(`inviting ${to} to team ${team}`);
};

const email = 'jane@example.com';
const teamId = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

sendInvite(teamId, email); // compiles, and invites a UUID to a team called jane@example.com
```

## The solution

Give each kind of value its own type. `new` checks the value, and the compiler keeps the types apart:

```ts
import { Email, Uuid } from '@horizon-republic/nominal-types';

const sendInvite = (to: Email, team: Uuid): void => {
  console.log(`inviting ${to.value} to team ${team.value}`);
};

const email = new Email('jane@example.com');
const teamId = new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');

sendInvite(email, teamId); // inviting jane@example.com to team 0190f1c2-…
sendInvite(teamId, email); // ❌ compile error: Type 'Uuid' is missing the following properties from type 'Email': …
sendInvite('jane@example.com', teamId); // ❌ compile error: Argument of type 'string' is not assignable to parameter of type 'Email'.
new Email('jane@'); // throws NominalError: nominal.Email: must be an email address (was a string of 5 characters)
```

Every `Email` you hold is valid, and it has methods such as `email.domain`. [What a nominal type is](docs/explanation/nominal-types.md) compares this with Zod's checked strings and with branded strings.

## Installation

```shell
npm install @horizon-republic/nominal-types
```

It works with both `import` and `require`, on Node.js 22.12 or later.

## Make your own type

A type is a class with a rule. Start from a built-in type, and add getters for its behaviour:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {
  public get category(): string {
    return this.value.slice(0, 3);
  }
}

new Sku('ABC-1234').category; // 'ABC'
Sku.parse('abc'); // { ok: false, issues: [{ message: 'must be matched by ^[A-Z]{3}-\d{4}$ (was "abc")' }] }
new Sku('abc'); // throws NominalError: shop.Sku: must be matched by ^[A-Z]{3}-\d{4}$ (was "abc")
```

## Works with your stack

Each adapter is a separate import path. Install the other library only if you use its adapter.

Validators:

- [ArkType](https://arktype.io) 2.2 or later: `toArk()` and `fromArk()` from `adapters/arktype`. [Guide](docs/guides/validators/arktype.md)
- [Zod](https://zod.dev) 4: `toZod()` from `adapters/zod`. [Guide](docs/guides/validators/zod.md)
- [Valibot](https://valibot.dev) 1: `toValibot()` from `adapters/valibot`. [Guide](docs/guides/validators/valibot.md)
- [class-validator](https://github.com/typestack/class-validator) 0.14 and 0.15: `@NominalField()` from `adapters/class-validator`. [Guide](docs/guides/validators/class-validator.md)
- any [Standard Schema](https://standardschema.dev) library: the type itself, or `n.of(Type)`, with no adapter. [Guide](docs/guides/validators/standard-schema.md)

Web frameworks:

- [NestJS](https://nestjs.com) 11 and 12: `NominalPipe` from `adapters/nest`, for parameters, bodies and message payloads. [Guide](docs/guides/frameworks/nestjs.md)

API and transport:

- [GraphQL](https://graphql.org) 16 and 17: scalars from `toGraphQL()` in `adapters/graphql`. [Guide](docs/guides/frameworks/graphql.md)
- [superjson](https://github.com/flightcontrolhq/superjson): `toSuperjson()` from `adapters/superjson`, so instances survive tRPC and Next.js. [Guide](docs/guides/frameworks/superjson.md)

Databases (values read back are checked):

- [MikroORM](https://mikro-orm.io) 7: `toMikroOrm()` from `adapters/mikro-orm`. [Guide](docs/guides/databases/mikro-orm.md)
- [TypeORM](https://typeorm.io) 0.3 and 1: `toTypeOrm()` from `adapters/typeorm`. [Guide](docs/guides/databases/typeorm.md)
- [Drizzle](https://orm.drizzle.team): `toDrizzle()` from `adapters/drizzle`. [Guide](docs/guides/databases/drizzle.md)
- [Sequelize](https://sequelize.org) 6: `toSequelize()` from `adapters/sequelize`. [Guide](docs/guides/databases/sequelize.md)

API docs:

- [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction) 11 and 12: `applyNominalTypes()` from `adapters/swagger`. [Guide](docs/guides/api-docs/swagger.md)
- JSON Schema: built into every type, with no adapter. [Guide](docs/guides/api-docs/json-schema.md)

Every path starts with `@horizon-republic/nominal-types/`, such as `@horizon-republic/nominal-types/adapters/zod`.

## What else it does

- [Check a whole request body](docs/guides/core/check-an-object.md) with `n.object()`, with no other library.
- [Check one field against another](docs/guides/core/check-fields-together.md) with `n.constraint()`.
- [Make a value object](docs/guides/core/make-a-value-object.md) of several fields, with getters and `copyWith()`.
- [Read configuration from environment variables](docs/guides/core/read-config.md) with `fromEnv()`.
- [Keep values out of error messages](docs/guides/core/hide-values.md), such as passwords.

## Built-in types

- Strings: `AnyString`, `NonEmptyString`, `NonBlankString`, `Email`, `Uuid`, `UuidV4`, `UuidV7`, `Ulid`, `ObjectId`, `SemVer`, `Url`, `HttpUrl`, `CountryCode`, `CurrencyCode`, `LanguageTag`, `MediaType`, `HexColor`, `Base64`, `Base64Url`, `Hostname`, `DomainName`, `IpAddress`, `Ipv4Address`, `Ipv6Address`, `IpPrefix`, `Ipv4Prefix`, `Ipv6Prefix`, `MacAddress`, `Isbn`, `Issn`, `Gtin`, `Isin`.
- Numbers: `AnyNumber`, `FiniteNumber`, `PositiveNumber`, `NegativeNumber`, `NonNegativeNumber`, `NonPositiveNumber`, `Float32`, `Latitude`, `Longitude`, `Integer`, `PositiveInteger`, `NegativeInteger`, `NonNegativeInteger`, `NonPositiveInteger`, `Int8`, `Int16`, `Int32`, `Uint8`, `Uint16`, `Uint32`, `Port`.
- Big integers: `AnyBigInt`, `PositiveBigInt`, `NegativeBigInt`, `NonNegativeBigInt`, `NonPositiveBigInt`, `Int64`, `Uint64`.
- Booleans: `AnyBoolean`.
- Dates and times, from `/temporal`: `Instant`, `PlainDate`, `PlainTime`, `PlainDateTime`.

[Built-in types](docs/reference/types/README.md) describes each one.

## Documentation

- [Tutorial](docs/tutorials/README.md): build a sign-up check, step by step. Start here.
- [Guides](docs/guides/README.md): how to do one task.
- [Reference](docs/reference/README.md): every export and built-in type.
- [Explanation](docs/explanation/README.md): why it works the way it does.

[Contributing](CONTRIBUTING.md) lists the scripts of this repository.

## License

Licensed under the terms in [LICENSE](LICENSE).
