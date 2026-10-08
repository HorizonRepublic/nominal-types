# Benchmarks

Every number on this page comes from one run on 8 Oct 2026: Node.js 24.21.0 on an Apple M4 Pro (arm64, 24 GB), macOS 26.3. Lower is better. For why the numbers look this way, see [Performance](../explanation/performance.md).

How the numbers are taken:

- Each library runs in a process of its own, so no library warms up or slows down another.
- A one-value case cycles through 1024 different inputs.
- One-value times are medians from [mitata](https://github.com/evanwashere/mitata). Document and NestJS times are the median of nine runs after three warm-ups.
- Each table names the command that prints it. The command also prints the runtime and machine it ran on.

## One value

`npm run bench`. One value at a time:

| Operation                                   |   Time |
| ------------------------------------------- | -----: |
| `Email.pattern.test(text)` alone            |  72 ns |
| `new Email(text)`                           |  82 ns |
| `Email.parse(text)`                         |  86 ns |
| `Email.parse(existing Email)`               |  12 ns |
| `Email.parse(invalid text)`                 | 240 ns |
| `new Email(invalid text)`, which throws     | 3.2 µs |
| `new Uuid(text)`                            | 106 ns |
| `new AnyString(text)`                       |  37 ns |
| `new Integer(n)`, three rules               |  38 ns |
| `new PositiveInteger(n)`, four rules        |  42 ns |
| `new AnyBigInt(text)`                       |  75 ns |
| `value instanceof Email`                    | 1.1 ns |
| `email.equals(other)`                       |  12 ns |
| `n.of(Uuid).array().parse(ids)`, 1000 UUIDs | 110 µs |

A rejected value costs more than an accepted one: the time goes into the message. `new` with a rejected value also throws, which costs far more.

What each level of a chain adds to `parse()`:

| Type                                  |  Time |
| ------------------------------------- | ----: |
| `AnyNumber`, 1 rule                   | 38 ns |
| `FiniteNumber`, 2 rules               | 50 ns |
| `Integer`, 3 rules                    | 55 ns |
| `PositiveInteger`, 4 rules            | 58 ns |
| `Uint16`, 4 rules                     | 59 ns |
| a subtype of `Uint16`, 2 more classes | 64 ns |

## Checks without an instance, and rejected values

`node bench/costs.ts`. Median time per call, Node.js 24.2, 8 Oct 2026. The order has a UUID, an email, a non-empty string, an integer from 0, a finite number, an optional string, a second UUID and 20 items, each a SKU and a positive integer.

| Operation                               |    Time |
| --------------------------------------- | ------: |
| `Number.isInteger(42)` alone            |  0.2 ns |
| `Integer.accepts(42)`                   |    7 ns |
| `Integer.parse(42)`                     |   33 ns |
| `Email.accepts(text)`                   |   61 ns |
| `Email.parse(text)`                     |   87 ns |
| `Order.accepts(order)`                  | 0.67 µs |
| `Order.parse(order)`                    |  2.7 µs |
| `Integer.accepts(4.2)`                  |    9 ns |
| `Integer.parse(4.2)`                    |   32 ns |
| `new Integer(4.2)`, error caught        |  5.1 µs |
| `Email.parse(invalid text)`             | 0.23 µs |
| `new Email(invalid text)`, error caught |  5.3 µs |
| `Order.accepts(order)`, bad email       | 0.07 µs |
| `Order.parse(order)`, bad email         |  3.2 µs |

## Writing JSON

`node bench/serialize.ts`. Median time per call, Node.js 24.2, 8 Oct 2026. The order from [Checks without an instance](#checks-without-an-instance-and-rejected-values), parsed with `Order.parse()`.

| Operation                               | One order | 1000 orders |
| --------------------------------------- | --------: | ----------: |
| `JSON.stringify(plain values)`          |   1.04 µs |     1.09 ms |
| `JSON.stringify(parsed)`                |   3.84 µs |     4.04 ms |
| `JSON.stringify(n.plain(parsed))`       |   2.32 µs |     2.36 ms |
| `JSON.stringify(Order.toPlain(parsed))` |   1.42 µs |     1.48 ms |
| `n.plain(parsed)` alone                 |   1.20 µs |           — |
| `Order.toPlain(parsed)` alone           |   0.33 µs |           — |

## Writing JSON with stringify()

Node.js 24.21, 8 Oct 2026, best of three runs. Each case runs in a process of its own with mitata, over a pool of different inputs: 256 orders, 8 lists of 1000 orders, 3 documents. The order has a UUID, an email, a name, two numbers, an optional note and a second UUID, then 20 items. The document is the 3 MB one from [A large document](#a-large-document). Without code generation, Node.js runs with `--disallow-code-generation-from-strings`, and a plain loop times the call, since mitata generates its own.

| Operation                                           | One order | 1000 orders | 3 MB document |
| --------------------------------------------------- | --------: | ----------: | ------------: |
| `JSON.stringify(plain values)`                      |   1.22 µs |     1.47 ms |       4.94 ms |
| `JSON.stringify(parsed)`                            |   4.22 µs |     4.60 ms |       13.3 ms |
| `JSON.stringify(n.plain(parsed))`                   |   2.62 µs |     2.99 ms |       10.4 ms |
| `JSON.stringify(Schema.toPlain(parsed))`            |   1.54 µs |     1.88 ms |       6.93 ms |
| `Schema.stringify(parsed)`                          |   0.58 µs |     0.83 ms |       4.42 ms |
| `Schema.stringify(parsed)`, without code generation |   2.42 µs |     2.75 ms |       9.03 ms |

## Memory

`node --expose-gc bench/memory.ts`. Heap per order, from 10,000 orders, Node.js 24.2.

| Form of the order                   |        Heap |
| ----------------------------------- | ----------: |
| plain values from `JSON.parse()`    | 1,319 bytes |
| instances from `Order.parse()`      | 3,391 bytes |
| `Order.toPlain()` of the parsed one | 1,522 bytes |

## Without code generation

`node bench/no-codegen.ts`, then `node --disallow-code-generation-from-strings bench/no-codegen.ts`. Median of seven runs, Node.js 24.2.

| Operation              | Generated code | Without |
| ---------------------- | -------------: | ------: |
| `Integer.parse(42)`    |          31 ns |   42 ns |
| `Email.parse(text)`    |          91 ns |   97 ns |
| `Order.parse(order)`   |         2.5 µs |  4.1 µs |
| `Order.accepts(order)` |        0.63 µs | 1.79 µs |
| `Order.toPlain(value)` |        0.33 µs | 1.06 µs |
| `n.plain(value)`       |        1.21 µs | 1.30 µs |

## Other libraries, one value

`npm run bench`. Each library gets unknown input and returns the value or the reasons it was rejected. Typia runs through `validate()`, which returns the reasons.

| Scenario                  | nominal-types |  Typia | ArkType |    Zod | Valibot |   Sury | Effect | TypeBox |    Joi | class-validator |
| ------------------------- | ------------: | -----: | ------: | -----: | ------: | -----: | -----: | ------: | -----: | --------------: |
| the same pattern, valid   |         41 ns |  46 ns |   22 ns |  48 ns |   34 ns |  28 ns |  48 ns |   14 ns | 130 ns |          424 ns |
| the same pattern, invalid |         67 ns | 113 ns |  1.5 µs | 293 ns |   60 ns | 3.5 µs | 424 ns |  483 ns | 970 ns |          1.1 µs |
| UUID, valid               |        110 ns |  71 ns |   64 ns | 102 ns |   86 ns | 100 ns |  99 ns |   71 ns | 212 ns |          464 ns |
| UUID, invalid             |        111 ns | 117 ns |  1.4 µs | 363 ns |  106 ns | 3.5 µs | 454 ns |  597 ns | 623 ns |          759 ns |
| email, valid              |         81 ns |  38 ns |   40 ns |  86 ns |   50 ns | 109 ns |      — |   47 ns | 845 ns |          1.5 µs |
| email, invalid            |        242 ns |  83 ns |  1.6 µs | 367 ns |   76 ns | 3.5 µs |      — |  584 ns | 795 ns |          1.7 µs |
| positive integer, valid   |         46 ns | 4.2 ns |   23 ns |  56 ns |   27 ns |  45 ns |  48 ns |  7.0 ns | 117 ns |          418 ns |
| positive integer, invalid |         57 ns |  44 ns |  1.4 µs | 181 ns |   82 ns | 5.6 µs | 405 ns |  427 ns | 541 ns |          672 ns |
| 1000 UUIDs in an array    |        108 µs |  68 µs |   56 µs |  96 µs |   81 µs |  63 µs |  82 µs |   75 µs | 205 µs |           85 µs |

- Only nominal-types returns an instance. The others return the input as it is.
- nominal-types is slower than the fastest libraries on a valid UUID, a valid email, a valid positive integer and a list of UUIDs. Building the instance costs part of it.
- nominal-types is slower on an invalid email than Typia and Valibot. An email is a [sensitive type](glossary.md), so the message leaves the address out, and writing that message takes the time.
- UUID and email use each library's own pattern. Ours accept UUID versions 1 to 8 with the RFC 9562 variant, plus nil and max, and check the RFC 5321 email length limits.
- A dash means the library has no built-in check for that case.

## A large document

`npm run bench:document`.

The document is 3 MB of JSON: 3000 customers with two addresses each, and 4300 orders with five items, each with a nested price. That is about 112,000 values. Two broken versions have one bad quantity in the last order, or a broken email in every hundredth customer.

| Setup                             | Valid document | One error deep inside | Every hundredth email broken |
| --------------------------------- | -------------: | --------------------: | ---------------------------: |
| ArkType                           |         1.8 ms |                 14 ms |                        13 ms |
| Typia                             |         2.8 ms |                6.2 ms |                       3.4 ms |
| nominal-types + ArkType adapter   |         5.5 ms |                 15 ms |                        13 ms |
| nominal-types `n.object()`        |         7.7 ms |                7.7 ms |                       7.3 ms |
| Zod                               |         7.7 ms |                8.5 ms |                       7.9 ms |
| Valibot                           |          11 ms |                8.1 ms |                       7.5 ms |
| nominal-types + Zod adapter       |          14 ms |                 13 ms |                        12 ms |
| nominal-types + Valibot adapter   |          15 ms |                 12 ms |                        12 ms |
| class-validator                   |         113 ms |                113 ms |                       112 ms |
| nominal-types + class-validator   |         126 ms |                124 ms |                       125 ms |
| nominal-types + ArkType, `n.of()` |         124 ms |                120 ms |                       226 ms |

Only the nominal-types rows build instances. `n.object()` builds one for each of the 112,000 values. The ArkType adapter builds one for each `toArk()` field.

## One ArkType object

`npm run bench`. An object with a UUID, an email and a count:

| Setup                               |   Time |
| ----------------------------------- | -----: |
| ArkType alone, plain values         |  95 ns |
| the ArkType adapter, with instances | 217 ns |
| `n.of()` fields inside ArkType      | 2.0 µs |

## In a NestJS app

`npm run bench:nest`.

The same 3 MB document is posted as a JSON body to a NestJS 12 app on Fastify. Each setup runs in a process of its own.

- class-validator DTOs go through `ValidationPipe({ transform: true })`.
- The other setups go through `@Body({ schema })` and Nest's `StandardSchemaValidationPipe`.
- The last two rows register 1000 other DTO classes in the same app.

| Setup                                                 |  Valid | One error deep inside | Every hundredth email broken |
| ----------------------------------------------------- | -----: | --------------------: | ---------------------------: |
| ArkType                                               |  22 ms |                 36 ms |                        34 ms |
| Typia                                                 |  23 ms |                 27 ms |                        25 ms |
| nominal-types + ArkType adapter                       |  26 ms |                 35 ms |                        34 ms |
| Zod                                                   |  26 ms |                 27 ms |                        27 ms |
| nominal-types `n.object()`                            |  29 ms |                 29 ms |                        28 ms |
| Valibot                                               |  29 ms |                 29 ms |                        28 ms |
| class-validator                                       | 134 ms |                133 ms |                       133 ms |
| nominal-types + ArkType, `n.of()`                     | 142 ms |                139 ms |                       247 ms |
| nominal-types + class-validator                       | 146 ms |                144 ms |                       144 ms |
| class-validator, with 1000 other DTOs in the app      |  1.1 s |                 1.1 s |                        1.1 s |
| nominal-types + class-validator, with 1000 other DTOs |  1.1 s |                 1.1 s |                        1.1 s |

About 20 ms of every request is Fastify reading the body and parsing the JSON.

## See also

- [Performance](../explanation/performance.md)
- [Choosing how to check input](../explanation/choosing-an-approach.md)

[← Reference](README.md)
