# Performance

## Measurements

Measured on an Apple M4 Pro with Node.js 25.3, after warm-up, one value at a time:

| Operation                                       | Time  |
| ----------------------------------------------- | ----- |
| `Email.pattern.test(text)` alone                | 68 ns |
| `new Email(text)`                               | 89 ns |
| `Email.parse(text)`                             | 94 ns |
| `Email.parse(existing Email)`                   | 14 ns |
| `Email.parse(invalid text)`                     | 86 ns |
| `new Uuid(text)`                                | 60 ns |
| `new AnyString(text)`                           | 21 ns |
| `new Integer(42)`, three rules                  | 37 ns |
| `new PositiveInteger(42)`, four rules           | 47 ns |
| `new AnyBigInt('9007199254740993')`             | 64 ns |
| `schemaOf(Uuid).array().parse(ids)`, 1000 UUIDs | 63 µs |

What the numbers mean:

- A type costs about as much as its own check, plus 15 to 20 ns to create the instance.
- Each extra rule adds a few nanoseconds, as the number types show.
- A schema from another library adds that library's cost. For a rejected value this can be much higher, as some libraries spend microseconds building messages.
- An array costs the same per item as `parse()`, about 63 ns for a UUID. Its count is checked before the items.
- A rejected value is cheaper through `parse()` than through `new`. Throwing and catching an error takes a few microseconds.

## How a chain runs

A type checks the rules of every level, from the base type down, and stops at the first failure.

When all the rules are regular expressions or type guards, they run as a simple list of checks. Two tricks make the list shorter:

- The string check is skipped before a regular expression, which rejects anything that isn't a string anyway. So `Email` and `Uuid` run only one check.
- Neighbouring patterns that start with `^` and have no `|` are joined into one regular expression and tested in one pass. If it fails, each pattern is tested on its own, so the error names the right one.

A rule from another library ends the simple list. From then on, each rule runs through its own `validate`.

[← Explanation](README.md)
