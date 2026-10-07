# @horizon-republic/nominal-types

Runtime-validated nominal types for TypeScript.

An email address, a UUID and a username are all `string` to the compiler. Nothing stops you from passing one where another is expected, and every function that receives one has to decide whether to check it again.

Here each of them is a class. You validate a value once, when it comes in, by constructing it. After that the compiler won't let you mix it up with other strings, and code that receives an `Email` knows it already holds a valid address.

Types can have their own methods, such as `email.domain` or `uuid.timestamp`. They work with any library that accepts [Standard Schema](https://standardschema.dev), and a NestJS pipe validates route parameters with them. Validation runs on [ArkType](https://arktype.io); constructing an `Email` takes about 100 ns.

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

## Contents

- [Getting started](#getting-started)
  - [Installation](#installation)
  - [Your first type](#your-first-type)
- [Guides](#guides)
  - [Declaring a type](#declaring-a-type)
  - [Adding behaviour](#adding-behaviour)
  - [Refining a type](#refining-a-type)
  - [Changing the rules of a built-in type](#changing-the-rules-of-a-built-in-type)
  - [Validating untrusted input](#validating-untrusted-input)
  - [Using a schema from another library](#using-a-schema-from-another-library)
  - [Embedding types in other validators](#embedding-types-in-other-validators)
  - [Generating JSON Schema](#generating-json-schema)
  - [NestJS](#nestjs)
- [Built-in types](#built-in-types)
  - [Email](#email)
  - [Uuid](#uuid)
  - [Url](#url)
  - [HttpUrl](#httpurl)
- [API](#api)
  - [Nominal()](#nominal)
  - [Static members](#static-members)
  - [Instance members](#instance-members)
  - [NominalError](#nominalerror)
  - [isNominalType()](#isnominaltype)
  - [Types](#types)
- [How it works](#how-it-works)
  - [Classes rather than brands](#classes-rather-than-brands)
  - [Validated once](#validated-once)
  - [Nominal at compile time](#nominal-at-compile-time)
  - [One identity across copies](#one-identity-across-copies)
  - [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

## Getting started

### Installation

```shell
npm install @horizon-republic/nominal-types
```

Any package manager works. The package ships ES modules and CommonJS side by side, each with its own type declarations, and runs on Node.js 22.12 or later. Its only runtime dependency is [ArkType](https://arktype.io).

### Your first type

A nominal type is a class declared with `Nominal()`: a name and a schema.

```ts
import { type } from 'arktype';
import { Nominal } from '@horizon-republic/nominal-types';

export class OrderNumber extends Nominal('OrderNumber', type(/^ORD-\d{8}$/u)) {}
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

## Guides

### Declaring a type

Pass `Nominal()` a unique name and a schema whose Standard Schema `validate` answers synchronously. ArkType types qualify directly:

```ts
import { type } from 'arktype';
import { Nominal } from '@horizon-republic/nominal-types';

export class Slug extends Nominal('Slug', type(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)) {}
export class Percentage extends Nominal('Percentage', type('0 <= number <= 100')) {}
```

The name brands the type at compile time and identifies it at runtime, so keep it unique among the nominal types one application loads.

### Adding behaviour

Add getters and methods to the class. They read `this.value`, the validated value:

```ts
export class OrderNumber extends Nominal('OrderNumber', type(/^ORD-\d{8}$/u)) {
  get year(): number {
    return Number(this.value.slice(4, 8));
  }

  get sequence(): number {
    return Number(this.value.slice(8));
  }
}

new OrderNumber('ORD-20261007').year; // 2026
```

### Refining a type

`refine()` makes a distinct subtype with a stricter schema. A refined instance is still an instance of its parent, while a parent instance is not a refined one, both in the compiler and at runtime:

```ts
export class ExpressOrderNumber extends OrderNumber.refine('ExpressOrderNumber', (schema) =>
  schema.and(/^ORD-9/u),
) {}

const express = new ExpressOrderNumber('ORD-90000001');

express instanceof OrderNumber; // true
new OrderNumber('ORD-20261007') instanceof ExpressOrderNumber; // false
express.year; // 9000: behaviour is inherited
```

The callback receives the parent's schema, so you can call ArkType methods such as `and` or `narrow` on it.

`parse()` also narrows an instance of the parent. It checks the parent's value against the stricter schema and returns an instance of the subtype, or the issues if the value doesn't fit:

```ts
const order = new OrderNumber('ORD-90000001');

ExpressOrderNumber.parse(order); // { ok: true, value: ExpressOrderNumber }
ExpressOrderNumber.parse(new OrderNumber('ORD-20261007')); // { ok: false, issues: [...] }
```

Only types up the chain are narrowed. An instance of an unrelated type is rejected even when its value would pass.

### Changing the rules of a built-in type

A subclass that overrides `schema` validates with its own rules and stays the same type as the class it extends. The built-in types keep their patterns as static fields, so you can build on them:

```ts
import { type } from 'arktype';
import { Email } from '@horizon-republic/nominal-types';

export class CompanyEmail extends Email {
  static override readonly pattern = /^[a-z.]+@example\.com$/u;
  static override readonly schema = type(CompanyEmail.pattern);
}

new CompanyEmail('jane.doe@example.com').mailbox; // 'jane.doe'
new CompanyEmail('jane@elsewhere.com'); // throws NominalError
```

The schema is built once, when the class is defined, so a subclass that changes `pattern` overrides `schema` along with it. Use `refine()` instead when the result should be a type of its own.

### Validating untrusted input

`new` throws, which suits values your own code produces. For input that might be wrong, such as a request body, use `parse()`: it returns the instance or the issues and never throws.

```ts
const result = Email.parse(input);

if (result.ok) {
  invite(result.value);
} else {
  reject(result.issues.map((issue) => issue.message));
}
```

`is()` narrows a value you already hold without building anything:

```ts
if (Email.is(value)) {
  value.domain;
}
```

`Email.parse(email)` returns the same object without validating it again, so checking a value you already built costs almost nothing.

### Using a schema from another library

Any schema that supports [Standard Schema](https://standardschema.dev) and answers synchronously can define a type, a Zod schema as well as an ArkType one:

```ts
import { z } from 'zod';
import { Nominal } from '@horizon-republic/nominal-types';

export class Sku extends Nominal('Sku', z.string().regex(/^SKU-\d{4}$/u)) {}
```

Issues come back as plain `{ message, path }` objects whichever library produced them. A schema whose `validate` returns a Promise is refused, since construction is synchronous.

### Embedding types in other validators

Every nominal type class is itself a Standard Schema through its static `~standard`. Libraries that call `~standard` take the class directly, NestJS 12's `@Body({ schema: Email })` among them.

Libraries that parse definitions treat a class as a function of their own, so give them the plain schema object `standard()` returns. In ArkType:

```ts
import { type } from 'arktype';
import { Email, Uuid } from '@horizon-republic/nominal-types';

const invitation = type({ email: Email.standard(), team: Uuid.standard() });

const { email } = invitation.assert({
  email: 'jane@example.com',
  team: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
});

email instanceof Email; // true
```

### Generating JSON Schema

A type built on a schema that can describe itself, as ArkType schemas can, also produces JSON Schema through [Standard JSON Schema](https://standardschema.dev):

```ts
Uuid['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
// { $schema: '…', type: 'string', pattern: '…', description: 'a UUID' }
```

A type whose schema cannot describe itself throws when asked.

### NestJS

`@horizon-republic/nominal-types/adapters/nest` provides `NominalPipe` for Nest 11 and 12. `@nestjs/common` is an optional peer dependency, so the core installs nothing from Nest.

#### Every parameter at once

Bind the pipe globally and declare parameters with a nominal type. Nest reflects the type from the handler signature, and the pipe turns the value into an instance:

```ts
import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';

app.useGlobalPipes(new NominalPipe());
```

```ts
@Controller('users')
export class UsersController {
  @Get(':id')
  find(@Param('id') id: Uuid) {
    return id.version; // an instance, already validated
  }
}
```

Arguments declared with any other type pass through untouched, so the global pipe sits safely next to other pipes. It relies on `emitDecoratorMetadata`, which Nest projects enable anyway.

#### One parameter

Pass the type explicitly, whatever the parameter is declared as:

```ts
@Get()
search(@Query('email', new NominalPipe(Email)) email: Email) {}
```

#### Errors

A rejected value fails the request with a 400 in the shape of Nest's own Standard Schema pipe:

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["id: must be a UUID (was \"nope\")"] }
```

Shape it differently with `exceptionFactory`, globally or per parameter:

```ts
new NominalPipe({
  exceptionFactory: (issues) => new UnprocessableEntityException(issues),
});

new NominalPipe(Email, {
  exceptionFactory: (issues, metadata) => new BadRequestException(`${metadata.data} is invalid`),
});
```

#### Headers

Nest runs no pipes on `@Headers()`, so validate header values in the handler with `parse()`.

## Built-in types

### Email

An email address in the dot-atom form RFC 5322 defines, at most 64 characters before the `@` and 254 in all, with plus addressing understood. Quoted local parts, IP-literal domains and Unicode domains are rejected; a Unicode domain passes once converted to punycode.

```ts
const email = new Email('Jane.Doe+news@Example.com');
```

| Member                 | Returns                                    | Example                           |
| ---------------------- | ------------------------------------------ | --------------------------------- |
| `local`                | everything before the `@`                  | `'Jane.Doe+news'`                 |
| `domain`               | everything after the `@`                   | `'Example.com'`                   |
| `mailbox`              | the local part without its tag             | `'Jane.Doe'`                      |
| `tag`                  | what follows the first `+`, or `undefined` | `'news'`                          |
| `withTag(tag)`         | the same mailbox with another tag          | `Jane.Doe+billing@Example.com`    |
| `withoutTag()`         | the same mailbox without a tag             | `Jane.Doe@Example.com`            |
| `canonical()`          | lowered and without a tag                  | `jane.doe@example.com`            |
| `isSameMailbox(other)` | whether both reach one mailbox             | `true` for `jane.doe@EXAMPLE.com` |

Use `canonical()` to tell whether two addresses belong to one person, say for a unique index; `equals()` compares exactly. Provider rules such as Gmail ignoring dots are up to you. `Email.pattern` and the fragments it's built from, `Email.atom`, `Email.label` and `Email.topLevel`, are static fields.

### Uuid

A UUID in its 8-4-4-4-12 text form: versions 1 to 8, the nil and the max value, in either case.

```ts
const id = new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');
```

| Member            | Returns                                                   | Example |
| ----------------- | --------------------------------------------------------- | ------- |
| `version`         | the version digit, 0 for nil and 15 for max               | `7`     |
| `timestamp`       | the generation time of a version 7 UUID, else `undefined` | `Date`  |
| `isNil` / `isMax` | whether it is the nil or the max UUID                     | `false` |
| `canonical()`     | the same UUID in lowercase                                |         |
| `equals(other)`   | compares regardless of case                               |         |

The pattern is the static field `Uuid.pattern`.

### Url

An absolute URL as the WHATWG URL standard parses it, with any scheme, `mailto:` and `javascript:` included. The value keeps the text as given, while the accessors read the parsed form.

```ts
const url = new Url('https://Example.com:8443/a/b?x=1#top');
```

| Member              | Returns                             | Example                                |
| ------------------- | ----------------------------------- | -------------------------------------- |
| `protocol`          | the scheme with its colon           | `'https:'`                             |
| `hostname` / `host` | the host, without and with the port | `'example.com'` / `'example.com:8443'` |
| `origin`            | scheme, host and port               | `'https://example.com:8443'`           |
| `pathname`          | the path                            | `'/a/b'`                               |
| `searchParams`      | a fresh copy of the query           | `URLSearchParams`                      |
| `toURL()`           | a fresh `URL`                       |                                        |
| `canonical()`       | the URL as the parser serialises it | `https://example.com:8443/a/b?x=1#top` |

### HttpUrl

A `Url` whose scheme is `http` or `https`, refined from `Url`: every `HttpUrl` is a `Url`, while a `Url` is not necessarily an `HttpUrl`.

```ts
new HttpUrl('https://example.com'); // fine
new HttpUrl('mailto:jane@example.com'); // throws NominalError
```

## API

### Nominal()

```ts
Nominal(name, schema);
```

Returns a class to extend. `name` has to be unique within an application; `schema` is any Standard Schema whose `validate` answers synchronously. A schema that also carries a Standard JSON Schema converter lets the type describe itself.

### Static members

| Member                      | Description                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `new Type(input)`           | Validates and builds an instance; throws `NominalError`                                                                                     |
| `Type.parse(input)`         | `{ ok: true, value }` or `{ ok: false, issues }`; never throws; returns an existing instance as is and narrows an instance of a parent type |
| `Type.is(value)`            | Type guard                                                                                                                                  |
| `Type.refine(name, narrow)` | A distinct subtype validated by `narrow(schema)`                                                                                            |
| `Type.standard()`           | The Standard Schema as a plain object, for libraries that parse definitions                                                                 |
| `Type['~standard']`         | Standard Schema and Standard JSON Schema properties                                                                                         |
| `Type.schema`               | The schema the type validates with                                                                                                          |
| `Type.typeName`             | The name given to `Nominal()`                                                                                                               |

### Instance members

| Member          | Description                              |
| --------------- | ---------------------------------------- |
| `value`         | The validated value                      |
| `equals(other)` | Same type and same value                 |
| `toJSON()`      | The value, so `JSON.stringify` writes it |
| `toString()`    | The value as a string                    |

### NominalError

Thrown by `new` for a rejected value. Extends `TypeError`.

| Member     | Description                                      |
| ---------- | ------------------------------------------------ |
| `typeName` | The name of the type that rejected the value     |
| `issues`   | Plain `{ message, path? }` objects               |
| `message`  | `'Email: must be an email address (was "nope")'` |

### isNominalType()

```ts
isNominalType(value): value is AnyNominalType
```

Whether a value is a nominal type class, including one loaded from another copy of this package. Adapters use it to spot a nominal type among the parameter types NestJS and similar libraries reflect.

### Types

| Type                                  | Description                                                    |
| ------------------------------------- | -------------------------------------------------------------- |
| `NominalType<Name, Schema>`           | A class returned by `Nominal()`                                |
| `RefinedType<Parent, Name>`           | A class returned by `refine()`                                 |
| `AnyNominalType`                      | Any nominal type class, for code that accepts them generically |
| `NominalInstance<Name, Value>`        | What every instance offers                                     |
| `NominalSchema<Input, Value>`         | What `Nominal()` accepts as a schema                           |
| `Parsed<Instance>`                    | The result of `parse()`                                        |
| `Brand<Name>`                         | The compile-time marker that keeps types apart                 |
| `InputOf<Schema>` / `ValueOf<Schema>` | The input and the value type of a schema                       |
| `StandardProps` / `StandardSchema`    | The shape of `~standard` and of what `standard()` returns      |

## How it works

### Classes rather than brands

A branded string exists only in the compiler: a cast gets around it, and it has no methods. Instances are only ever built from values their constructor accepted. They have methods such as `email.mailbox` and keep their identity through generic code. The price is one small object per value.

### Validated once

The constructor is the only place a value is checked. Holding an instance means holding a valid value, so passing it on, storing it or handing it to `parse()` again costs no validation.

### Nominal at compile time

Each type has a phantom brand keyed by its name, so two types that wrap a string do not mix. A refined type has its parent's key and its own, which makes it assignable to the parent and not the other way round.

### One identity across copies

An application can load this package twice, once as ES modules and once as CommonJS. Each type marks its instances with a key from `Symbol.for`, and `instanceof` checks that key, so one copy recognises an instance the other built.

### Performance

Measured on an Apple M4 Pro with Node.js 25.3, after warm-up, one value at a time:

| Operation                             | Time   |
| ------------------------------------- | ------ |
| ArkType alone, on the `Email` pattern | 69 ns  |
| `new Email(text)`                     | 108 ns |
| `Email.parse(text)`                   | 116 ns |
| `Email.parse(existing Email)`         | 16 ns  |
| `Email.parse(invalid text)`           | 1.7 µs |
| `new Uuid(text)`                      | 76 ns  |

A rejected value costs more because the schema writes out its messages. That is also why boundaries use `parse()`: catching an exception from `new` adds a few microseconds on top.

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
