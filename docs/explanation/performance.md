# Performance

## Measurements

Measured on an Apple M4 Pro with Node.js 25.3, after warm-up, one value at a time:

| Operation                                       | Time  |
| ----------------------------------------------- | ----- |
| `Email.pattern.test(text)` alone                | 68 ns |
| `new Email(text)`                               | 89 ns |
| `Email.parse(text)`                             | 94 ns |
| `Email.parse(existing Email)`                   | 6 ns  |
| `Email.parse(invalid text)`                     | 86 ns |
| `new Uuid(text)`                                | 60 ns |
| `new AnyString(text)`                           | 21 ns |
| `new Integer(42)`, three rules                  | 25 ns |
| `new PositiveInteger(42)`, four rules           | 31 ns |
| `new AnyBigInt('9007199254740993')`             | 64 ns |
| `value instanceof Email`, `email.equals(other)` | 5 ns  |
| `schemaOf(Uuid).array().parse(ids)`, 1000 UUIDs | 70 µs |

What the numbers mean:

- A type costs about as much as its own check, plus 15 to 20 ns to create the instance.
- Each extra rule adds about 2 ns, as the number types show.
- A schema from another library adds that library's cost. For a rejected value this can be much higher, as some libraries spend microseconds building messages.
- An array costs about 10 ns per item on top of the item's own check, 70 ns for a UUID. Its count is checked before the items.
- Each level of a type's class chain adds about 2 ns to `new`, because V8 calls every constructor in the chain. `Port` under `Uint16` under `Integer` costs a few nanoseconds more than `Uint16` itself.
- A rejected value is cheaper through `parse()` than through `new`. Throwing and catching an error takes a few microseconds.

## Compared with other libraries

`npm run bench` checks the same values with ten libraries and prints the median time per call. Each library is called the way code calls it at a boundary: it gets unknown input and returns something usable, a value or the reasons it was rejected. Measured on an Apple M4 Pro, Node.js 25.3, 7 Oct 2026:

| Scenario                  | nominal-types | Typia | ArkType |    Zod | Valibot |   Sury | Effect | TypeBox |    Joi | class-validator |
| ------------------------- | ------------: | ----: | ------: | -----: | ------: | -----: | -----: | ------: | -----: | --------------: |
| the same pattern, valid   |         37 ns | 44 ns |   14 ns |  30 ns |   29 ns |  42 ns |  30 ns |   12 ns | 208 ns |          417 ns |
| the same pattern, invalid |         51 ns | 99 ns |  1.4 µs | 236 ns |   68 ns | 5.2 µs | 390 ns |  542 ns | 739 ns |          896 ns |
| UUID, valid               |         71 ns | 52 ns |   52 ns |  60 ns |   73 ns |  83 ns |  76 ns |   58 ns | 139 ns |          332 ns |
| email, valid              |         91 ns | 36 ns |   39 ns |  52 ns |   40 ns |  84 ns |      — |   41 ns | 638 ns |               — |
| positive integer, valid   |         40 ns |  0 ns |    8 ns |  47 ns |   24 ns |  42 ns |  43 ns |    0 ns | 106 ns |          339 ns |
| 1000 UUIDs in an array    |         69 µs | 55 µs |   50 µs |  69 µs |   69 µs |  53 µs |  67 µs |   54 µs | 166 µs |               — |

How to read it:

- Every other library returns the input as it is. nominal-types creates an instance and a result object, which costs about 25 to 30 ns. It shows most where the check itself is nearly free, as for a positive integer.
- A rejected value is cheaper here than anywhere else, because messages are built from a description and the value, with no error tree.
- UUID and email depend on each library's own pattern. The UUID pattern here only accepts versions 1 to 8 with the RFC 9562 variant, plus nil and max. The email pattern also checks the RFC 5321 length limits. Both do more than most of the others, and pay for it.
- A dash means the library has no built-in check for that case.

The second table of the run gives the cost of each level of a type, from `AnyNumber` to `Port` under `Uint16`.

## A large document

`npm run bench:document` validates a 2.9 MB export: 3000 customers with addresses, and 5500 orders with five items each, about 112,000 values to check. Each library describes the same document. nominal-types doesn't validate objects itself yet, so it appears inside ArkType and inside class-validator DTOs. Measured on an Apple M4 Pro, Node.js 25.3, 7 Oct 2026, median of five runs:

| Library                         | Valid document | One error deep inside | Every hundredth email broken |
| ------------------------------- | -------------: | --------------------: | ---------------------------: |
| Typia                           |         2.8 ms |                7.0 ms |                       3.9 ms |
| ArkType                         |         3.7 ms |                 18 ms |                        15 ms |
| Valibot                         |         7.1 ms |                7.1 ms |                       7.1 ms |
| Zod                             |         8.2 ms |                8.0 ms |                       7.4 ms |
| class-validator                 |          94 ms |                 94 ms |                        96 ms |
| nominal-types + class-validator |          98 ms |                 99 ms |                       101 ms |
| nominal-types + ArkType         |         110 ms |                110 ms |                       214 ms |

How to read it:

- Inside class-validator, nominal types add about 5% to its own time.
- Inside ArkType, they make it about 30 times slower. ArkType compiles its own schemas, but a nominal type is a foreign Standard Schema to it, and it runs every such field through a slower path. The checks themselves are not the cost: 112,000 values at about 50 ns each take about 6 ms.
- So nominal types are fast per value, and as fast as the library around them for whole documents.

## How a chain runs

A type checks the rules of every level, from the base type down, and stops at the first failure.

When all the rules are regular expressions or type guards, they run as a simple list of checks. Two tricks make the list shorter:

- The string check is skipped before a regular expression, which rejects anything that isn't a string anyway. So `Email` and `Uuid` run only one check.
- Neighbouring patterns that start with `^` and have no `|` are joined into one regular expression and tested in one pass. If it fails, each pattern is tested on its own, so the error names the right one.

A rule from another library doesn't end the list: it becomes a step that runs its `validate` and passes the value it produced to the next step.

## Checks generated per type

The first time a type checks a value, it builds one function for all its rules, with `new Function`. V8 can inline the checks of such a function, because each of its calls only ever sees one rule. A loop shared by every type can't be inlined that way, and was about 40% slower for `PositiveInteger`.

A rule from another library becomes a step of the same function. Which way it runs is decided once: its `validate`, called directly, or the runner of a `schemaOf()` schema. A type that mixes such a rule with patterns, like an ArkType schema under `AnyString`, is generated as a whole as well. Measured with ArkType:

| Type                                  | Before | After |
| ------------------------------------- | ------ | ----- |
| `Nominal('Sku', type(/^SKU-\d{4}$/))` | 56 ns  | 47 ns |
| the same rule under `AnyString`       | 74 ns  | 51 ns |
| an ArkType rule that trims its value  | 64 ns  | 55 ns |

Where code generation is forbidden, such as in Cloudflare Workers or under a strict Content-Security-Policy, the same checks run in a loop instead. The results are the same, only slower.

## instanceof

Each type checks its own brand with its own function, generated like the rule checks, instead of one `instanceof` handler shared by every type. A shared handler reads a different brand for every type and can't be optimised. With one per type, `instanceof`, `parse()` of an existing instance and `equals()` take about 5 ns instead of 13 to 16.

## Regular expressions

V8 already compiles a regular expression to machine code. A hand-written character loop for `Uuid` was slower than its pattern in our measurements, and native engines such as RE2 add the cost of leaving JavaScript. So patterns stay plain regular expressions.

The built-in patterns are also safe from catastrophic backtracking. `Email` starts with a lookahead that limits the whole address to 254 characters, and its worst inputs within that limit take about 1 µs.

[← Explanation](README.md)
