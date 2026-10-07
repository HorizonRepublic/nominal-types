# Booleans

[Built-in types](README.md) › Booleans

## AnyBoolean

Root of the boolean types.

| Property    | Value                                                  |
| ----------- | ------------------------------------------------------ |
| Accepts     | `true`, `false`                                        |
| Rejects     | `0`, `1`, `'true'`, `''`, `null`, `new Boolean(false)` |
| JSON Schema | `{ type: 'boolean' }`                                  |
| Message     | `must be a boolean (was 1)`                            |

```ts
import { AnyBoolean, schemaOf } from '@horizon-republic/nominal-types';

class MarketingConsent extends AnyBoolean.subtype('shop.MarketingConsent') {}

new MarketingConsent(true).value; // true
MarketingConsent.parse('true'); // { ok: false, issues: [{ message: 'must be a boolean (was "true")' }] }
schemaOf(MarketingConsent).fromString().parse('true'); // { ok: true, value: MarketingConsent }
```

To read `'true'` and `'false'` from text, use [`fromString()`](../schemas.md#fromstring).

[← Built-in types](README.md)
