# Performance

Measured on an Apple M4 Pro with Node.js 25.3, after warm-up, one value at a time:

| Operation                        | Time  |
| -------------------------------- | ----- |
| `Email.pattern.test(text)` alone | 69 ns |
| `new Email(text)`                | 85 ns |
| `Email.parse(text)`              | 88 ns |
| `Email.parse(existing Email)`    | 15 ns |
| `Email.parse(invalid text)`      | 54 ns |
| `new Uuid(text)`                 | 57 ns |

Patterns and type guards run directly, without the Standard Schema call around them, so a type costs about its own check plus 15 to 20 ns for the instance. A schema from a library adds that library's cost, which can be far higher for a rejected value, since some libraries spend microseconds writing out their messages. Boundaries use `parse()` rather than catching exceptions from `new`, which costs a few microseconds more.

[← Documentation](../README.md)
