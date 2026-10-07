# Built-in types

Each built-in type is a subtype of the type above it in the tree. An instance passes wherever any type above it is expected; an instance of a type above does not pass for it.

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

- Rules run from the root down and stop at the first that fails; the error names the type and carries that rule's message.
- The JSON Schema of a type is an `allOf` of the rules from the root down. The string check of `AnyString` is left out where the next rule is a pattern or `Url`'s rule, which check for a string themselves; a type left with one rule is described by that rule alone.
- None of the types converts its input, except `AnyBigInt` and the types under it, which take a decimal string.

[← Documentation](../../README.md)
