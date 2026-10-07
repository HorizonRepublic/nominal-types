# Big integers

[Built-in types](README.md) › Big integers

## AnyBigInt

Root of the big integer types. `value` is always a `bigint`.

| Property    | Value                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Accepts     | any `bigint`; a decimal string of at most 1000 characters, `'0'` or an optional `-` and digits without leading zeros |
| Rejects     | `'+1'`, `'01'`, `'-0'`, `'1.0'`, `'1e3'`, `'0x10'`, `' 1'`, numbers, `Object(1n)`                                    |
| JSON Schema | `{ type: 'string', pattern: '^(?:0\|-?[1-9]\\d*)$', maxLength: 1000 }`, for input and output                         |
| `toJSON()`  | the decimal string                                                                                                   |
| Message     | `must be a bigint or an integer string (was 1.5)`                                                                    |

```ts
const id = new AnyBigInt('9007199254740993');

id.value; // 9007199254740993n
JSON.stringify({ id }); // '{"id":"9007199254740993"}'
new AnyBigInt('42').equals(new AnyBigInt(42n)); // true
```

A string longer than 1000 characters is rejected before it is converted.

## Sign types

Each sign type, and `Int64` and `Uint64`, also adds an example its JSON Schema accepts.

| Type                | Accepts | Adds to JSON Schema                                  | Message ends with        |
| ------------------- | ------- | ---------------------------------------------------- | ------------------------ |
| `PositiveBigInt`    | `≥ 1`   | `{ type: 'string', pattern: '^[1-9]\\d*$' }`         | `a positive integer`     |
| `NegativeBigInt`    | `≤ -1`  | `{ type: 'string', pattern: '^-[1-9]\\d*$' }`        | `a negative integer`     |
| `NonNegativeBigInt` | `≥ 0`   | `{ type: 'string', pattern: '^(?:0\|[1-9]\\d*)$' }`  | `a non-negative integer` |
| `NonPositiveBigInt` | `≤ 0`   | `{ type: 'string', pattern: '^(?:0\|-[1-9]\\d*)$' }` | `a non-positive integer` |

## Int64 and Uint64

`AnyBigInt` › `Int64`, `AnyBigInt` › `Uint64`

| Type     | Accepts           | Adds to JSON Schema                                                |
| -------- | ----------------- | ------------------------------------------------------------------ |
| `Int64`  | -2^63 to 2^63 - 1 | `{ type: 'string', format: 'int64', maxLength: 20 }`               |
| `Uint64` | 0 to 2^64 - 1     | `{ type: 'string', pattern: '^(?:0\|[1-9]\\d*)$', maxLength: 20 }` |

The JSON Schema limits the length of the string, not the value: `'9223372036854775808'` passes the schema of `Int64` and is rejected by the type. Messages end with `a signed 64-bit integer (was 9223372036854775808n)`.

[← Built-in types](README.md)
