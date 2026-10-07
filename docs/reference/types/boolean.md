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
export class MarketingConsent extends AnyBoolean.subtype('MarketingConsent') {}
```

[← Built-in types](README.md)
