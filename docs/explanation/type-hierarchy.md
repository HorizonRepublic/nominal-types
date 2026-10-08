# Type hierarchy

Why do the built-in types form a tree, and why are there three ways to build one type on another? This page explains the choices behind the hierarchy.

## Why base types

A value often belongs to several kinds at once. A port is a 16-bit unsigned integer, which is an integer, which is a number.

Different code cares about different levels:

- code that adds up integers should accept a port;
- code that opens a socket should accept only a port.

A tree of types gives you both. Each type sits under the closest kind it belongs to. It gets that kind's checks, and it fits wherever that kind is expected. So `Port` under `Uint16` takes one line.

Your own rule sees only values that passed the checks above it. Under `NonNegativeInteger`, it gets whole numbers from 0 up and needs no checks of its own for that.

The roots are `AnyString`, `AnyNumber`, `AnyBigInt` and `AnyBoolean`, and the four date and time types. They are the [base types](../reference/glossary.md). Their names start with `Any`, because `String` and `Number` already belong to JavaScript.

## Why a type can pass for a type in another branch

Each type has one parent, so some related types end up in different branches. `PositiveInteger` sits under `Integer`, and `PositiveNumber` under `FiniteNumber`. Yet every positive integer is a positive number.

So a type can name the types it [implies](../reference/glossary.md): types that accept every value it accepts. Its instances then pass for those types too, at compile time and for `instanceof`:

```ts
import { PositiveInteger, PositiveNumber } from '@horizon-republic/nominal-types';

const applyRate = (rate: PositiveNumber): number => rate.value;

applyRate(new PositiveInteger(3)); // 3
new PositiveInteger(3) instanceof PositiveNumber; // true
```

The built-in types follow one rule. A type implies another when every value it accepts is accepted by the other. Each type lists its implied types by hand, and the list is checked by tests. The package never works them out at runtime. The lists are in [Strings](../reference/types/string.md#implied-types), [Numbers](../reference/types/number.md#implied-types) and [Big integers](../reference/types/bigint.md#implied-types).

Only ranges, signs and the shapes `NonEmptyString` and `NonBlankString` are implied, never a meaning. An email address is never empty or blank, so every `Email` passes for a `NonBlankString`. `Base64` implies nothing, since it accepts `''`. `Port` implies `PositiveInteger`, but nothing implies `Port`, `Latitude` or `Longitude`. The number 45 fits the range of `Latitude`, but it isn't a latitude because of that.

An implication is a promise the type makes, not a check. So `parse()` of the implied type checks the value again and returns an instance of its own:

```ts
import { Integer, PositiveInteger, PositiveNumber } from '@horizon-republic/nominal-types';

const count = new PositiveInteger(3);

PositiveNumber.parse(count); // { ok: true, value: PositiveNumber { value: 3 } }
Integer.parse(count); // { ok: true, value: PositiveInteger { value: 3 } }
```

A type above in the same branch returns the instance as it is, as `Integer` does here.

## Why start under a base type

A type made with `AnyString.subtype()` and a type made with `Nominal()` check values the same way. They differ in one thing: only a type under a base type has a text form.

A text form says how to read the type from a string. `fromString()` and `fromEnv()` use it to read `'3'` from a query string or an environment variable. A type made from scratch with `Nominal()` doesn't say what kind of value it holds. It may be a number, a string or an object, so the package can't know how to read it from text.

That is why the docs start strings, numbers, big integers and booleans under a base type. `Nominal()` is for objects and for values no base type fits.

## Why three ways to build on a type

Two questions describe how a new type relates to the original:

- Can the new type go where the original is expected?
- Can the original go where the new type is expected?

Each tool answers them differently:

| Tool        | New type where the original goes | Original where the new type goes | What it is                                                                |
| ----------- | -------------------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| `subtype()` | yes                              | no                               | a narrower case, such as a staff email                                    |
| `extends`   | yes                              | yes                              | the same type with more methods                                           |
| `variant()` | no                               | no                               | a [sibling](../reference/glossary.md) with the same methods and new rules |

`subtype()` is the default. It is the only one where both the compiler and the runtime know exactly what was checked.

`extends` keeps the same type. Any original passes for the subclass. So a rule added in the subclass can't be relied on by code that receives it.

`variant()` replaces a rule, so it has to be a separate type. If it passed for the original, code relying on the original's rule would get values that never passed it.

## Why limits are new types

Built-in types have no options such as a maximum. A limit is a subtype instead. That gives three things:

- the limit has a name, such as `Percentage`;
- the name shows in function signatures, so `(value: Percentage)` says what it needs;
- the limit travels with the type, including into its JSON Schema.

One limit is fixed: an `AnyBigInt` string can be at most 1000 characters.

## Why zero splits the sign types

`PositiveInteger` and `NonNegativeInteger` differ by one value: zero. A quantity in an order can't be zero, but a stock count can. So each sign comes in two forms, without zero and with it.

How `-0` and `NaN` behave is listed in the [number types reference](../reference/types/number.md).

## Why big integers travel as strings

JSON has no bigint. `JSON.stringify` throws on one, and most JSON parsers lose digits after 2^53. So database drivers and APIs often send 64-bit integers as decimal strings. `AnyBigInt` reads such a string and writes it back as a string.

It also reads a number, as long as it is a [safe integer](../reference/glossary.md). So an ID sent as `42` works. A larger number may have lost digits before it arrived. `AnyBigInt` can't tell, so it refuses the number and asks for a string:

```ts
import { AnyBigInt } from '@horizon-republic/nominal-types';

AnyBigInt.parse('9007199254740993'); // { ok: true, value: AnyBigInt { value: 9007199254740993n } }
AnyBigInt.parse(42); // { ok: true, value: AnyBigInt { value: 42n } }
AnyBigInt.parse(2 ** 53);
// { ok: false, issues: [{ message: 'must be a bigint or an integer string, since a number this large may have lost digits (was 9007199254740992)' }] }
```

## See also

- [How to make a stricter type or a variant](../guides/core/build-on-a-type.md)
- [How to declare a type](../guides/core/declare-a-type.md)
- [The implies option](../reference/declaring.md#nominaloptions)
- [Built-in types](../reference/types/README.md)
- [What a nominal type is](nominal-types.md)

[← Explanation](README.md)
