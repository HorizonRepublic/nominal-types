# How to read configuration from environment variables

This guide shows how to read and check all environment variables of an app in one place, when it starts.

## Describe the configuration

List the variables with `n.object()`, call `.fromEnv()`, and make a type of it with `Nominal()`:

```ts
// config.ts
import { AnyBoolean, HttpUrl, n, Nominal, Port } from '@horizon-republic/nominal-types';

export class Config extends Nominal(
  'app.Config',
  n.object({
    PORT: Port,
    API_URL: HttpUrl,
    DEBUG: n.of(AnyBoolean).fromString().optional(),
  }).fromEnv(),
) {}

export const config = new Config(process.env);
```

`.fromEnv()` reads each field of a number, boolean, big integer or string type from its text. Variables the schema doesn't list are dropped, so passing the whole `process.env` is fine.

## Use the values

Import `config` and read its fields:

```ts
// main.ts
import { config } from './config.ts';

console.log(config.PORT.value, config.API_URL.value, config.DEBUG?.value);
```

Run it with the variables set:

```sh
PORT=3000 API_URL=https://api.example.com DEBUG=true node main.ts
```

The output is:

```
3000 https://api.example.com true
```

## See what is wrong

When a variable is wrong or missing, `new Config(process.env)` throws one `NominalError` that lists all of them:

```sh
PORT=80a node main.ts
```

```
NominalError: app.Config: PORT: must be a number (was a string of 3 characters); API_URL: must be a URL (was undefined)
```

## Keep secrets out of the error

Variables often hold passwords and keys. So a `.fromEnv()` schema leaves every value out of its messages, as a [sensitive type](hide-values.md) does. A wrong value is shown by its length only:

```sh
PORT=3000 API_URL=postgres://admin:S3cr3t@db/x node main.ts
```

```
NominalError: app.Config: API_URL: must be an http or https URL (was a string of 28 characters)
```

Don't print `process.env` itself next to the error. The values would reach the log that way.

## Make a variable optional

Wrap the type in `n.of()`, then call `.fromString()` before `.optional()`, as `DEBUG` does in `config.ts`. `.fromEnv()` reads only plain type fields. A field wrapped in `n.of()` keeps its text as it is.

Without `.fromString()`, a number in an optional variable is rejected:

```ts
import { n, Port } from '@horizon-republic/nominal-types';

const Wrong = n.object({ PORT: n.of(Port).optional() }).fromEnv();
const Right = n.object({ PORT: n.of(Port).fromString().optional() }).fromEnv();

Wrong.parse({ PORT: '3000' }); // { ok: false, issues: [{ message: 'must be a number (was a string of 4 characters)', path: ['PORT'] }] }
Right.parse({ PORT: '3000' }); // { ok: true, value: { PORT: Port { value: 3000 } } }
Right.parse({}); // { ok: true, value: {} }
```

## See also

- [Schemas](../../reference/schemas.md): `fromEnv()` and `fromString()`.
- [How to read numbers and booleans from text](read-text-values.md)
- [How to make a value object](make-a-value-object.md), for the type made with `Nominal()`.

[← Guides](../README.md)
