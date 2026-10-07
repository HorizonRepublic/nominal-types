# Numbers

[Built-in types](README.md) › Numbers

Rules for all number types:

- Only values of type `number` are accepted. `'1'` and `new Number(1)` are rejected.
- Values are never rounded or converted.
- Messages show the rejected value: `must be a positive integer (was -0)`.
- To read a number from text, such as `'3'`, use [`fromString()`](../schemas.md#fromstring).

```ts
import { PositiveInteger } from '@horizon-republic/nominal-types';

new PositiveInteger(3).value; // 3
new PositiveInteger(-0); // throws NominalError: nominal.PositiveInteger: must be a positive integer (was -0)
```

## AnyNumber

Root of the number types. Accepts any `number`, `NaN`, `Infinity` and `-Infinity` included.

| Property    | Value                        |
| ----------- | ---------------------------- |
| JSON Schema | `{ type: 'number' }`         |
| Message     | `must be a number (was "1")` |

`JSON.stringify` writes `NaN` and the infinities as `null`.

## FiniteNumber

`AnyNumber` › `FiniteNumber`

Accepts any number but `NaN`, `Infinity` and `-Infinity`: the numbers JSON can carry, the 64-bit double of other languages.

| Property    | Value                                       |
| ----------- | ------------------------------------------- |
| JSON Schema | adds `{ type: 'number', format: 'double' }` |
| Message     | `must be a finite number (was NaN)`         |

## Sign types

| Type                 | Parent         | Accepts | 0   | `-0` | Adds to JSON Schema                       | Message ends with        |
| -------------------- | -------------- | ------- | --- | ---- | ----------------------------------------- | ------------------------ |
| `PositiveNumber`     | `FiniteNumber` | `> 0`   | no  | no   | `{ type: 'number', exclusiveMinimum: 0 }` | `a positive number`      |
| `NegativeNumber`     | `FiniteNumber` | `< 0`   | no  | no   | `{ type: 'number', exclusiveMaximum: 0 }` | `a negative number`      |
| `NonNegativeNumber`  | `FiniteNumber` | `≥ 0`   | yes | yes  | `{ type: 'number', minimum: 0 }`          | `a non-negative number`  |
| `NonPositiveNumber`  | `FiniteNumber` | `≤ 0`   | yes | yes  | `{ type: 'number', maximum: 0 }`          | `a non-positive number`  |
| `PositiveInteger`    | `Integer`      | `≥ 1`   | no  | no   | `{ type: 'integer', minimum: 1 }`         | `a positive integer`     |
| `NegativeInteger`    | `Integer`      | `≤ -1`  | no  | no   | `{ type: 'integer', maximum: -1 }`        | `a negative integer`     |
| `NonNegativeInteger` | `Integer`      | `≥ 0`   | yes | yes  | `{ type: 'integer', minimum: 0 }`         | `a non-negative integer` |
| `NonPositiveInteger` | `Integer`      | `≤ 0`   | yes | yes  | `{ type: 'integer', maximum: 0 }`         | `a non-positive integer` |

`-0` keeps its sign in `value`. `equals()` compares with `Object.is`, so `-0` does not equal `0`, and `NaN` equals `NaN`.

## Integer

`AnyNumber` › `FiniteNumber` › `Integer`

Accepts a whole number from `Number.MIN_SAFE_INTEGER` to `Number.MAX_SAFE_INTEGER`, -(2^53 - 1) to 2^53 - 1. `2 ** 53` and beyond are rejected.

| Property    | Value                                                                             |
| ----------- | --------------------------------------------------------------------------------- |
| JSON Schema | adds `{ type: 'integer', minimum: -9007199254740991, maximum: 9007199254740991 }` |
| Message     | `must be a safe integer (was 1.5)`                                                |

## Sized integers

`AnyNumber` › `FiniteNumber` › `Integer` › each sized type

| Type     | Accepts                         | Adds to JSON Schema                                    |
| -------- | ------------------------------- | ------------------------------------------------------ |
| `Int8`   | -128 to 127                     | `{ type: 'integer', minimum: -128, maximum: 127 }`     |
| `Int16`  | -32,768 to 32,767               | `{ type: 'integer', minimum: -32768, maximum: 32767 }` |
| `Int32`  | -2,147,483,648 to 2,147,483,647 | the same bounds and `format: 'int32'`                  |
| `Uint8`  | 0 to 255                        | `{ type: 'integer', minimum: 0, maximum: 255 }`        |
| `Uint16` | 0 to 65,535                     | `{ type: 'integer', minimum: 0, maximum: 65535 }`      |
| `Uint32` | 0 to 4,294,967,295              | `{ type: 'integer', minimum: 0, maximum: 4294967295 }` |

Messages end with `a signed 8-bit integer`, `an unsigned 16-bit integer` and so on. The sized types sit next to the sign types: a `Uint8` is not a `NonNegativeInteger`.

## Port

`AnyNumber` › `FiniteNumber` › `Integer` › `Uint16` › `Port`

A TCP or UDP port number from 1 to 65,535. Port 0 is not accepted: it asks the system for any free port, so it is not a port to connect to. Use `Uint16` where 0 belongs.

| Property    | Value                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| JSON Schema | adds `{ type: 'integer', minimum: 1, maximum: 65535 }`, with an example |
| Message     | `must be a port from 1 to 65535 (was 0)`                                |

```ts
import { Port, schemaOf } from '@horizon-republic/nominal-types';

new Port(8080).value; // 8080
schemaOf(Port).fromString().parse('443'); // { ok: true, value: Port { value: 443 } }
schemaOf(Port).fromString().parse('+80'); // { ok: false, issues: [{ message: 'must be a number (was "+80")' }] }
```

## Latitude and Longitude

`AnyNumber` › `FiniteNumber` › `Latitude`, and `AnyNumber` › `FiniteNumber` › `Longitude`

A position on Earth in decimal degrees, as GPS and GeoJSON write it. Both ends of each range are accepted.

| Type        | Accepts     | Adds to JSON Schema                               | Message ends with              |
| ----------- | ----------- | ------------------------------------------------- | ------------------------------ |
| `Latitude`  | -90 to 90   | `{ type: 'number', minimum: -90, maximum: 90 }`   | `a latitude from -90 to 90`    |
| `Longitude` | -180 to 180 | `{ type: 'number', minimum: -180, maximum: 180 }` | `a longitude from -180 to 180` |

-180 and 180 are the same line on Earth, but `equals()` tells them apart.

```ts
import { Latitude, Longitude, objectOf } from '@horizon-republic/nominal-types';

const Place = objectOf({ lat: Latitude, lon: Longitude });

Place.parse({ lat: 51.5072, lon: -0.1276 }).ok; // true
Place.parse({ lat: 91, lon: 0 }); // { ok: false, issues: [{ message: 'must be a latitude from -90 to 90 (was 91)', path: ['lat'] }] }
```

## Float32

`AnyNumber` › `FiniteNumber` › `Float32`

Accepts a number a 32-bit float holds exactly, where `Math.fround(value) === value`: `0.5`, `0.25`, `16777216`, `Math.fround(0.1)`. Rejects `0.1`, `16777217` and anything beyond about 3.4 × 10^38.

| Property    | Value                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| JSON Schema | adds `{ type: 'number', format: 'float' }`; exactness is checked at runtime only |
| Message     | `must be a 32-bit float (was 0.1)`                                               |

[← Built-in types](README.md)
