# How to send nominal types through superjson

`toSuperjson()` keeps instances, such as an `Email`, when data crosses the wire with [superjson](https://github.com/flightcontrolhq/superjson), as in tRPC, Next.js server actions or Remix. Without it, an instance arrives as a plain string.

## Before you start

- Install the package and superjson:

  ```sh
  npm install @horizon-republic/nominal-types superjson
  ```

- The helper comes from the adapter's entry point, `@horizon-republic/nominal-types/adapters/superjson`. It doesn't import superjson, so it has no peer dependency.

## Quick example

Register each type you send, in one file that both the server and the client import:

```ts
// superjson.ts
import superjson from 'superjson';
import { Email, Uuid } from '@horizon-republic/nominal-types';
import { toSuperjson } from '@horizon-republic/nominal-types/adapters/superjson';

superjson.registerCustom(...toSuperjson(Email));
superjson.registerCustom(...toSuperjson(Uuid));

export { superjson };
```

`toSuperjson()` gives the transformer and the name to register it under, so both spread into `registerCustom()`.

## Send and receive instances

Use the superjson from that file on both sides:

```ts
// main.ts
import { Email } from '@horizon-republic/nominal-types';

import { superjson } from './superjson';

const text = superjson.stringify({ to: new Email('jane@example.com') });
// {"json":{"to":"jane@example.com"},"meta":{"values":{"to":[["custom","nominal.Email"]]},"v":1}}

const { to } = superjson.parse<{ to: Email }>(text);
// to is an Email again; to.domain is 'example.com'
```

With tRPC, pass this superjson as the `transformer`.

What arrives:

- Each value is checked by its type on the way in.
- Big integers keep every digit: an `Int64` of `9007199254740993n` arrives as the same `Int64`.
- A type that holds an object, such as a [value object](../core/make-a-value-object.md), arrives with instances inside it.

## Register subtypes

Each transformer takes instances of its own class only. A subtype needs its own registration:

```ts
// superjson.ts
import superjson from 'superjson';
import { Email } from '@horizon-republic/nominal-types';
import { toSuperjson } from '@horizon-republic/nominal-types/adapters/superjson';

export class StaffEmail extends Email.subtype('shop.StaffEmail', /@example\.com$/u) {}

superjson.registerCustom(...toSuperjson(Email));
superjson.registerCustom(...toSuperjson(StaffEmail));

export { superjson };
```

Without the second line, a `StaffEmail` arrives as the plain string `'jane@example.com'`, not as an `Email`.

## Errors

A value the type refuses throws a `NominalError` from `superjson.parse()`:

```text
NominalError: nominal.Email: must be an email address (was a string of 4 characters)
```

Catch it where you call `parse()`.

## Limits

- An unregistered type arrives as a plain value, with no warning. Register every type you send, subtypes included.
- The name a type is registered under is its type name, such as `nominal.Email`. Both sides must use the same type names.

## See also

- [superjson adapter reference](../../reference/adapters/superjson.md): what `toSuperjson()` returns.
- [How to use nominal types with GraphQL](graphql.md)
- [How to make a value object](../core/make-a-value-object.md)

[← Guides](../README.md)
