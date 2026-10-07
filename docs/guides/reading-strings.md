# How to read values from strings

This guide shows how to turn text into number and boolean types: environment variables, query strings, form fields or CSV cells. Everything there is a string, even `PORT=8080`.

## Reading one value

Start from `schemaOf()` and add `.fromString()`:

```ts
import { schemaOf, Uint16 } from '@horizon-republic/nominal-types';

schemaOf(Uint16).fromString().parse('8080'); // { ok: true, value: Uint16 } holding 8080
schemaOf(Uint16).fromString().parse('70000'); // { ok: false, … 'must be an unsigned 16-bit integer (was 70000)' }
```

What it accepts:

| Type family                       | Text it reads                                          | Text it rejects                                 |
| --------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| numbers (`AnyNumber` and below)   | numbers written the JSON way: `'2'`, `'-1.5'`, `'1e3'` | `''`, `' 2'`, `'02'`, `'+2'`, `'0x10'`, `'NaN'` |
| booleans (`AnyBoolean` and below) | `'true'`, `'false'`                                    | `'TRUE'`, `'1'`, `'yes'`                        |
| strings and big integers          | any text, as it is                                     | nothing extra                                   |

Rejected text reaches the type's rule unchanged, so the message is the usual one: `must be a number (was "02")`.

Values that are already not strings, like `8080`, are checked as they are.

## Describing a config

Describe the whole configuration with `objectOf()`, read its fields from text with `fromEnv()`, and make a type of it:

```ts
import {
  AnyBoolean,
  HttpUrl,
  Nominal,
  objectOf,
  schemaOf,
  Uint16,
} from '@horizon-republic/nominal-types';

export class Port extends Uint16.subtype('app.Port') {}

export class Config extends Nominal(
  'app.Config',
  objectOf({
    PORT: Port,
    API_URL: HttpUrl,
    DEBUG: schemaOf(AnyBoolean).fromString().optional(),
  }).fromEnv(),
) {}

export const config = new Config(process.env);

config.PORT; // Port, read from the text '3000'
config.API_URL; // HttpUrl
```

What `fromEnv()` does:

- Each field of a nominal type with a text form is read from a string: numbers, booleans, big integers and strings.
- Variables the schema doesn't list are dropped, so passing the whole `process.env` is fine.
- Fields of other schemas are kept as they are. For an optional one, give it `fromString()` yourself, as `DEBUG` above.

When something is wrong, `new Config(process.env)` throws one `NominalError` listing every variable:

```
app.Config: PORT: must be a number (was "80a"); API_URL: must be a URL (was undefined)
```

## Reading lists

Call `.fromString()` before `.array()`, so each item is read:

```ts
schemaOf(PositiveInteger).fromString().array().parse(['1', '2']); // two PositiveInteger values
```

`fromString()` only works right after `schemaOf()`. Calling it after `array()`, `optional()` or `nullable()` throws a `TypeError`. It also throws for a type made from scratch with `Nominal()`, which has no text form.

In NestJS, the global `NominalPipe` reads query and route strings for you. See [How to validate NestJS route parameters](nestjs.md).

[← Guides](README.md)
