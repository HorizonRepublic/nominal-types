# superjson

Entry point: `@horizon-republic/nominal-types/adapters/superjson`. It doesn't import superjson, so it has no peer dependency.

| Export                 | Kind     | Use it for                                        |
| ---------------------- | -------- | ------------------------------------------------- |
| `toSuperjson()`        | function | a superjson custom transformer for a nominal type |
| `SuperjsonTransformer` | type     | the transformer `toSuperjson()` returns           |
| `SuperjsonValue`       | type     | a JSON value, as superjson takes it               |

## toSuperjson()

```ts
function toSuperjson<Target extends AnyNominalType>(
  target: Target,
): [SuperjsonTransformer<Target['prototype']>, string];
```

| Parameter | Type         | Description                  |
| --------- | ------------ | ---------------------------- |
| `target`  | nominal type | the type to send and receive |

Returns the transformer and the name to register it under, the type name such as `nominal.Email`. Spread both into `superjson.registerCustom()`. Register on the server and on the client.

| Member         | Does                                                             |
| -------------- | ---------------------------------------------------------------- |
| `isApplicable` | takes instances of this very class only, not of its subtypes     |
| `serialize`    | writes the value; a big integer as its digits, an object as JSON |
| `deserialize`  | checks the value with the type and returns an instance           |

A subtype, such as `WorkEmail` under `Email`, needs its own `registerCustom()`. Otherwise it arrives as a plain value.

### Errors

`deserialize` throws a `NominalError` for a value the type rejects: `NominalError: nominal.Email: must be an email address (was a string of 4 characters)`.

## Example

```ts
import superjson from 'superjson';
import { toSuperjson } from '@horizon-republic/nominal-types/adapters/superjson';
import { Email, Int64 } from '@horizon-republic/nominal-types';

superjson.registerCustom(...toSuperjson(Email));
superjson.registerCustom(...toSuperjson(Int64));

const text = superjson.stringify({ to: new Email('jane@example.com'), balance: new Int64(9007199254740993n) });
// {"json":{"to":"jane@example.com","balance":"9007199254740993"},
//  "meta":{"values":{"to":[["custom","nominal.Email"]],"balance":[["custom","nominal.Int64"]]},"v":1}}

const { to, balance } = superjson.parse<{ to: Email; balance: Int64 }>(text);
to instanceof Email; // true
balance.value; // 9007199254740993n

superjson.parse(text.replace('jane@example.com', 'jane'));
// throws NominalError: nominal.Email: must be an email address (was a string of 4 characters)
```

## See also

- [How to send nominal types through superjson](../../guides/frameworks/superjson.md)
- [Errors and messages](../errors-and-messages.md)

[← Adapters](README.md) · [← Reference](../README.md)
