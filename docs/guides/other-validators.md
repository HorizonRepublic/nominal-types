# Embedding types in other validators

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

[← Documentation](../README.md)
