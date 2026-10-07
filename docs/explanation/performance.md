# Performance

## Measurements

Measured on an Apple M4 Pro with Node.js 25.3, after warm-up, one value at a time:

| Operation                             | Time  |
| ------------------------------------- | ----- |
| `Email.pattern.test(text)` alone      | 68 ns |
| `new Email(text)`                     | 89 ns |
| `Email.parse(text)`                   | 94 ns |
| `Email.parse(existing Email)`         | 14 ns |
| `Email.parse(invalid text)`           | 86 ns |
| `new Uuid(text)`                      | 60 ns |
| `new AnyString(text)`                 | 21 ns |
| `new Integer(42)`, three rules        | 37 ns |
| `new PositiveInteger(42)`, four rules | 47 ns |
| `new AnyBigInt('9007199254740993')`   | 64 ns |

Patterns and type guards run directly, without the Standard Schema call around them, so a type costs about its own check plus 15 to 20 ns for the instance. Each rule a level adds costs a few nanoseconds more, as the number types show. A schema from a library adds that library's cost, which can be far higher for a rejected value, since some libraries spend microseconds writing out their messages. A rejected value costs more through `new` than through `parse()`, since throwing and catching an error takes a few microseconds; that is why `parse()` exists for input that is expected to be wrong.

## How a chain runs

A type validates with the rules of every level from the root down, and stops at the first rule that fails. When every rule is a pattern or a type guard, which don't change the value, the chain runs them as a flat list of checks rather than one Standard Schema call each.

Two steps make the list shorter. The string check of `AnyString` is left out in front of a pattern, which rejects anything but a string with the same message; `Email` and `Uuid` therefore run a single rule. And neighbouring patterns that start with `^` and hold no `|` are folded into one regular expression of lookaheads, tested in one pass. Such patterns only match from the start of the string, so testing them together there is the same as testing them apart; a pattern with `|` or without `^` is tested on its own. When a folded expression fails, the patterns are tested one by one to report the one that failed.

A rule from another library ends the flat list: the chain then calls each rule's `validate` in turn and passes on the value it produced.

[← Documentation](../README.md)
