# Type hierarchy

## Why base types

A value usually belongs to more than one kind at once. A port is a 16-bit unsigned integer, which is an integer, which is a finite number. Code that sums integers shouldn't care that one of them is a port, while code that opens a socket should accept nothing else.

A tree of types expresses exactly that. Each type sits under the most specific type it is a case of, inherits that type's checks, and passes wherever any type above it is expected. Declaring `Port` under `Uint16` costs one line and answers both needs: `total(ports)` compiles, `listen(new Uint16(80))` doesn't.

The roots are the kinds of value JavaScript has: strings, numbers, big integers and booleans. They are called `AnyString` and so on rather than `String`, because those names belong to JavaScript's own wrappers, and because "any" says what they accept.

## Why three ways to build on a type

Two questions decide what a derived type is: may it go where the original is expected, and may the original go where it is expected? Three of the four answers are useful, and each has its own tool.

A **subtype** answers yes and no. It is a narrower case of the original, the way an express order is an order, so it passes for the original but not the other way round. This is the default, and the only one that keeps both the compiler and the runtime honest about what a value has been checked against.

**`extends`** answers yes and yes. It is the same type, and the class is only a place to put more behaviour. Since the original passes for the subclass, a rule the subclass adds can't promise anything to the code that receives one. That is why the guide warns about it, and why a stricter rule belongs in a subtype instead.

A **variant** answers no and no. It is a sibling with the original's behaviour and its own rule, for cases such as a legacy number format the same methods still apply to. Replacing a rule is what makes it a separate type: if a variant passed for the original, code relying on the original's rule would get values that never passed it.

The fourth answer, no and yes, would be a type that the original passes for but that doesn't pass for the original. Nothing in practice wants that, so there is no tool for it.

## Why limits are new types

A built-in type has no options such as a maximum length or an upper bound. A limit is declared as a subtype instead, for three reasons. The limit gets a name, which is how the rest of the code refers to it. It shows in the brand, so a function that needs values up to 100 can say so in its signature. And it holds wherever the type travels, including in its JSON Schema, where an option set at one call site would be lost.

The one fixed limit, the 1000 characters of an `AnyBigInt` string, sits on the root because it has to act before the string is converted. A subtype only ever sees the converted `bigint`.

## Why zero splits the sign types

`Positive` and `NonNegative` differ by one value, and that value is the one that matters most often. A quantity in an order can't be zero, while a stock count can. Folding them into one type would make one of the two checks impossible to express, so each sign comes in a form without zero and one with it.

`-0` is treated as zero: it is neither positive nor negative, and the types that take zero take it too. Its sign is kept in `value`, because the package doesn't convert values; `equals()` uses `Object.is`, which tells `-0` and `0` apart and treats `NaN` as equal to itself.

## Why big integers travel as strings

JSON has no bigint, `JSON.stringify` throws on one, and a JSON number past 2^53 loses digits in most parsers. A decimal string survives every hop, which is why database drivers and APIs commonly send 64-bit integers that way. `AnyBigInt` takes that string as input and writes it back, so a value read from JSON and written again stays the same.

[← Documentation](../README.md)
