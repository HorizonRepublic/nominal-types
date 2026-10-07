# Performance

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

Patterns and type guards run directly, without the Standard Schema call around them, so a type costs about its own check plus 15 to 20 ns for the instance. Each rule a level adds costs a few nanoseconds more, as the number types show. Under `AnyString`, the string check is left out in front of a pattern, which rejects anything but a string by itself, so `Email` and `Uuid` run a single rule. A schema from a library adds that library's cost, which can be far higher for a rejected value, since some libraries spend microseconds writing out their messages. Boundaries use `parse()` rather than catching exceptions from `new`, which costs a few microseconds more.

[← Documentation](../README.md)
