# How to send nominal types through superjson

This guide shows how to keep instances, such as an `Email`, when data crosses the wire with [superjson](https://github.com/flightcontrolhq/superjson): in tRPC, Next.js server actions, Remix and other places that use it. Without it, an instance arrives as a plain string.

The helper comes from a separate entry point, `@horizon-republic/nominal-types/adapters/superjson`. It doesn't import superjson.

## Registering types

Register each type you send, on the server and on the client:

```ts
import superjson from 'superjson';
import { toSuperjson } from '@horizon-republic/nominal-types/adapters/superjson';
import { Email, Uuid } from '@horizon-republic/nominal-types';

superjson.registerCustom(...toSuperjson(Email));
superjson.registerCustom(...toSuperjson(Uuid));
```

`toSuperjson()` gives the transformer and the name to register it under, so they spread into `registerCustom()`.

## What arrives

```ts
const text = superjson.stringify({ to: new Email('jane@example.com') });
const { to } = superjson.parse<{ to: Email }>(text);

to; // Email, checked again on the way in
```

- Each transformer takes instances of its own class only. Register a subtype, such as `WorkEmail`, on its own, or it arrives as a plain value.
- What arrives is checked by the type. A value it refuses throws a `NominalError`.
- Big integers keep every digit, and a type holding an object arrives with the instances inside it.

[← Guides](README.md)
