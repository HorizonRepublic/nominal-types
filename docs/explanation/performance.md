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
| `new Integer(42)`, three rules                  | 25 ns |
| `new PositiveInteger(42)`, four rules           | 31 ns |
| `new AnyBigInt('9007199254740993')`             | 64 ns |
| `schemaOf(Uuid).array().parse(ids)`, 1000 UUIDs | 63 µs |

What the numbers mean:

- A type costs about as much as its own check, plus 15 to 20 ns to create the instance.
- Each extra rule adds about 2 ns, as the number types show.
- A schema from another library adds that library's cost. For a rejected value this can be much higher, as some libraries spend microseconds building messages.
- An array costs the same per item as `parse()`, about 63 ns for a UUID. Its count is checked before the items.
- A rejected value is cheaper through `parse()` than through `new`. Throwing and catching an error takes a few microseconds.

## How a chain runs

A type checks the rules of every level, from the base type down, and stops at the first failure.

When all the rules are regular expressions or type guards, they run as a simple list of checks. Two tricks make the list shorter:

- The string check is skipped before a regular expression, which rejects anything that isn't a string anyway. So `Email` and `Uuid` run only one check.
- Neighbouring patterns that start with `^` and have no `|` are joined into one regular expression and tested in one pass. If it fails, each pattern is tested on its own, so the error names the right one.

A rule from another library ends the simple list. From then on, each rule runs through its own `validate`.

## Checks generated per type

The first time a type checks a value, it builds one function for its list of checks, with `new Function`. V8 can inline the checks of such a function, because each of its calls only ever sees one rule. A loop shared by every type can't be inlined that way, and was about 40% slower for `PositiveInteger`.

Where code generation is forbidden, such as in Cloudflare Workers or under a strict Content-Security-Policy, the same checks run in a loop instead. The results are the same, only slower.

## Regular expressions

V8 already compiles a regular expression to machine code. A hand-written character loop for `Uuid` was slower than its pattern in our measurements, and native engines such as RE2 add the cost of leaving JavaScript. So patterns stay plain regular expressions.

The built-in patterns are also safe from catastrophic backtracking. `Email` starts with a lookahead that limits the whole address to 254 characters, and its worst inputs within that limit take about 1 µs.

[← Explanation](README.md)
