# Big integers

[Built-in types](README.md) › Big integers

## AnyBigInt

Root of the big integer types. `value` is always a `bigint`.

| Property            | Value                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Accepts             | any `bigint`; a decimal string of at most 1000 characters, `'0'` or an optional `-` and digits without leading zeros |
| Also accepts        | a whole number from `-(2^53 - 1)` to `2^53 - 1`, such as `42`                                                        |
| Rejects             | `'+1'`, `'01'`, `'-0'`, `'1.0'`, `'1e3'`, `'0x10'`, `' 1'`, `1.5`, `NaN`, numbers beyond `2^53 - 1`, `Object(1n)`    |
| JSON Schema, input  | `anyOf` of the output string and `{ type: 'integer', minimum: -9007199254740991, maximum: 9007199254740991 }`        |
| JSON Schema, output | `{ type: 'string', pattern: '^(?:0\|-?[1-9]\\d*)$', maxLength: 1000 }`                                               |
| `toJSON()`          | the decimal string                                                                                                   |
| Message             | `must be a bigint, an integer string or a safe integer (was 1.5)`                                                    |

```ts
import { AnyBigInt } from '@horizon-republic/nominal-types';

const id = new AnyBigInt('9007199254740993');

id.value; // 9007199254740993n
JSON.stringify({ id }); // '{"id":"9007199254740993"}'
new AnyBigInt('42').equals(new AnyBigInt(42n)); // true
new AnyBigInt(42).value; // 42n
```

A string longer than 1000 characters is rejected before it is converted.

A number beyond `2^53 - 1` is rejected, because it may already have lost digits. The message says so:

```ts
import { AnyBigInt } from '@horizon-republic/nominal-types';

AnyBigInt.parse(2 ** 53);
// { ok: false, issues: [{ message: 'must be a bigint or an integer string, since a number this large may have lost digits (was 9007199254740992)' }] }
```

## Sign types

Each sign type, and `Int64` and `Uint64`, adds an example its JSON Schema accepts. The [input schema](../json-schema.md#input-and-output) adds a string and a number, joined by `anyOf`. The output schema adds the string only.

| Type                | Accepts | Adds for a string                                    | Adds for a number                  | Message ends with        |
| ------------------- | ------- | ---------------------------------------------------- | ---------------------------------- | ------------------------ |
| `PositiveBigInt`    | `≥ 1`   | `{ type: 'string', pattern: '^[1-9]\\d*$' }`         | `{ type: 'integer', minimum: 1 }`  | `a positive integer`     |
| `NegativeBigInt`    | `≤ -1`  | `{ type: 'string', pattern: '^-[1-9]\\d*$' }`        | `{ type: 'integer', maximum: -1 }` | `a negative integer`     |
| `NonNegativeBigInt` | `≥ 0`   | `{ type: 'string', pattern: '^(?:0\|[1-9]\\d*)$' }`  | `{ type: 'integer', minimum: 0 }`  | `a non-negative integer` |
| `NonPositiveBigInt` | `≤ 0`   | `{ type: 'string', pattern: '^(?:0\|-[1-9]\\d*)$' }` | `{ type: 'integer', maximum: 0 }`  | `a non-positive integer` |

## Int64 and Uint64

`AnyBigInt` › `Int64`, `AnyBigInt` › `Uint64`

| Type     | Accepts           | Adds for a string                                                  | Adds for a number                 |
| -------- | ----------------- | ------------------------------------------------------------------ | --------------------------------- |
| `Int64`  | -2^63 to 2^63 - 1 | `{ type: 'string', format: 'int64', maxLength: 20 }`               | `{ type: 'integer' }`             |
| `Uint64` | 0 to 2^64 - 1     | `{ type: 'string', pattern: '^(?:0\|[1-9]\\d*)$', maxLength: 20 }` | `{ type: 'integer', minimum: 0 }` |

The JSON Schema limits the length of the string, not the value: `'9223372036854775808'` passes the schema of `Int64` and is rejected by the type. Messages show the value as it was given: `must be a signed 64-bit integer (was "9223372036854775808")` for the string, `(was 9223372036854775808n)` for the bigint.

## Implied types

A type [implies](../glossary.md) another when every value it accepts is accepted by the other. Its instances fit where the other type is expected, for the compiler, `instanceof` and `equals()`.

| Type             | Also passes for     |
| ---------------- | ------------------- |
| `PositiveBigInt` | `NonNegativeBigInt` |
| `NegativeBigInt` | `NonPositiveBigInt` |
| `Uint64`         | `NonNegativeBigInt` |

The other big integer types imply nothing. `parse()` of an implied type checks the value again and returns an instance of that type:

```ts
import { NonNegativeBigInt, Uint64 } from '@horizon-republic/nominal-types';

NonNegativeBigInt.parse(new Uint64(42n)); // { ok: true, value: NonNegativeBigInt { value: 42n } }
new Uint64(42n) instanceof NonNegativeBigInt; // true
```

[← Built-in types](README.md)
