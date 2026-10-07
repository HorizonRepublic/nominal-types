# Built-in types

Each type in the tree is a subtype of the type above it. An instance fits wherever a type above it is expected, but not the other way round: every `Email` is an `AnyString`, but not every `AnyString` is an `Email`.

Using these types is optional. You can declare any type from scratch with `Nominal()`.

```text
AnyString                     any string
├── Email
├── Uuid
└── Url
    └── HttpUrl

AnyNumber                     any number, NaN and the infinities included
└── FiniteNumber              any number but NaN and the infinities
    ├── PositiveNumber            > 0
    ├── NegativeNumber            < 0
    ├── NonNegativeNumber         ≥ 0
    ├── NonPositiveNumber         ≤ 0
    ├── Float32                   exact as a 32-bit float
    └── Integer                   a safe integer
        ├── PositiveInteger           ≥ 1
        ├── NegativeInteger           ≤ -1
        ├── NonNegativeInteger        ≥ 0
        ├── NonPositiveInteger        ≤ 0
        ├── Int8, Int16, Int32
        └── Uint8, Uint16, Uint32

AnyBigInt                     any integer, as a bigint
├── PositiveBigInt                ≥ 1
├── NegativeBigInt                ≤ -1
├── NonNegativeBigInt             ≥ 0
├── NonPositiveBigInt             ≤ 0
├── Int64
└── Uint64

AnyBoolean                    true or false
```

| Page                      | Types                                          |
| ------------------------- | ---------------------------------------------- |
| [Strings](string.md)      | `AnyString`, `Email`, `Uuid`, `Url`, `HttpUrl` |
| [Numbers](number.md)      | `AnyNumber` and the 17 types under it          |
| [Big integers](bigint.md) | `AnyBigInt`, its sign types, `Int64`, `Uint64` |
| [Booleans](boolean.md)    | `AnyBoolean`                                   |

## Common to every built-in type

- Rules run from the root down and stop at the first failure. The error names the type and gives that rule's message.
- Values are never converted. The one exception is `AnyBigInt` and the types under it, which also accept a decimal string or a whole number up to `2^53 - 1`.
- The JSON Schema of every type has its name as `title`. A type with several rules gets an `allOf`, one entry per rule. The string check of `AnyString` is left out when the next rule checks for a string itself.

[← Reference](../README.md)
