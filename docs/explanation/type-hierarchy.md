# Type hierarchy

## Why base types

A value often belongs to several kinds at once. A port is a 16-bit unsigned integer, which is an integer, which is a number.

Different code cares about different levels:

- code that adds up integers should accept a port;
- code that opens a socket should accept only a port.

A tree of types gives you both. Each type sits under the closest kind it belongs to. It gets that kind's checks, and it fits wherever that kind is expected. `Port` under `Uint16` takes one line.

The base types are optional. `Nominal()` creates a type from scratch, and it is just as valid. Base types are one way to keep code tidy: related types live in one tree, and common checks are written once.

The roots are named `AnyString`, `AnyNumber`, `AnyBigInt` and `AnyBoolean`. Names like `String` already belong to JavaScript, and "any" says what the root accepts.

## Why three ways to build on a type

Two questions describe how a new type relates to the original:

1. Can the new type go where the original is expected?
2. Can the original go where the new type is expected?

Each tool answers them differently:

| Tool        | 1   | 2   | What it is                                 |
| ----------- | --- | --- | ------------------------------------------ |
| `subtype()` | yes | no  | a narrower case, like an express order     |
| `extends`   | yes | yes | the same type with more methods            |
| `variant()` | no  | no  | a sibling with the same methods, new rules |

`subtype()` is the default. It is the only one where both the compiler and the runtime know exactly what was checked.

`extends` keeps the same type. Because any original passes for the subclass, a rule added in the subclass can't be relied on by code that receives it.

`variant()` replaces a rule, so it has to be a separate type. If it passed for the original, code relying on the original's rule would get values that never passed it.

The fourth combination, "no" then "yes", has no practical use, so there is no tool for it.

## Why limits are new types

Built-in types have no options like a maximum. A limit is a subtype instead. That gives three things:

- the limit has a name, such as `Percentage`;
- the name shows in function signatures, so `(value: Percentage)` says what it needs;
- the limit travels with the type, including into its JSON Schema.

There is one fixed limit: an `AnyBigInt` string can be at most 1000 characters. It sits on the root because it must run before the string is turned into a `bigint`. A subtype only sees the result.

## Why zero splits the sign types

`Positive` and `NonNegative` differ by one value: zero. Zero matters often. A quantity in an order can't be zero, but a stock count can. So each sign comes in two forms, without zero and with it.

`-0` counts as zero. It keeps its sign in `value`, because the package never changes values. `equals()` uses `Object.is`, so `-0` is not equal to `0`, and `NaN` is equal to `NaN`.

## Why big integers travel as strings

JSON has no bigint. `JSON.stringify` throws on one, and most JSON parsers lose digits after 2^53. A decimal string survives every step. That is why database drivers and APIs often send 64-bit integers as strings.

`AnyBigInt` reads such a string and writes it back the same way.

[← Explanation](README.md)
