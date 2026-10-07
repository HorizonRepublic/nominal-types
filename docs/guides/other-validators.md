# How to use a type inside another validator

This guide shows how to put nominal types into a schema from another library, so the library hands back instances.

For a library that reads `~standard`, such as NestJS 12's `@Body({ schema: Email })`, pass the class itself; every nominal type is a Standard Schema.

For a library that parses its own definitions, such as ArkType, pass the plain object `standard()` returns, since such libraries treat a class as a definition of their own:

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

[← Documentation](../README.md)
