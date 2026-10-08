# Benchmarks

Times measured on an Apple M4 Pro on 7 Oct 2026. Each table names its Node.js version and its command. Lower is better. For why the numbers look this way, see [Performance](../explanation/performance.md).

## One value

One value at a time, after warm-up, Node.js 25.3:

| Operation                                       |  Time |
| ----------------------------------------------- | ----: |
| `Email.pattern.test(text)` alone                | 68 ns |
| `new Email(text)`                               | 89 ns |
| `Email.parse(text)`                             | 94 ns |
| `Email.parse(existing Email)`                   |  6 ns |
| `Email.parse(invalid text)`                     | 86 ns |
| `new Uuid(text)`                                | 60 ns |
| `new AnyString(text)`                           | 21 ns |
| `new Integer(42)`, three rules                  | 25 ns |
| `new PositiveInteger(42)`, four rules           | 31 ns |
| `new AnyBigInt('9007199254740993')`             | 64 ns |
| `value instanceof Email`, `email.equals(other)` |  5 ns |
| `n.of(Uuid).array().parse(ids)`, 1000 UUIDs     | 70 µs |

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

`npm run bench`. Median time per call, Node.js 25.3. Each library gets unknown input and returns a value or the reasons it was rejected.

| Scenario                  | nominal-types | Typia | ArkType |    Zod | Valibot |   Sury | Effect | TypeBox |    Joi | class-validator |
| ------------------------- | ------------: | ----: | ------: | -----: | ------: | -----: | -----: | ------: | -----: | --------------: |
| the same pattern, valid   |         37 ns | 44 ns |   14 ns |  30 ns |   29 ns |  42 ns |  30 ns |   12 ns | 208 ns |          417 ns |
| the same pattern, invalid |         51 ns | 99 ns |  1.4 µs | 236 ns |   68 ns | 5.2 µs | 390 ns |  542 ns | 739 ns |          896 ns |
| UUID, valid               |         71 ns | 52 ns |   52 ns |  60 ns |   73 ns |  83 ns |  76 ns |   58 ns | 139 ns |          332 ns |
| email, valid              |         91 ns | 36 ns |   39 ns |  52 ns |   40 ns |  84 ns |      — |   41 ns | 638 ns |               — |
| positive integer, valid   |         40 ns |  0 ns |    8 ns |  47 ns |   24 ns |  42 ns |  43 ns |    0 ns | 106 ns |          339 ns |
| 1000 UUIDs in an array    |         69 µs | 55 µs |   50 µs |  69 µs |   69 µs |  53 µs |  67 µs |   54 µs | 166 µs |               — |

- Only nominal-types returns an instance. The others return the input as it is.
- UUID and email use each library's own pattern. Ours accept UUID versions 1 to 8 with the RFC 9562 variant, plus nil and max, and check the RFC 5321 email length limits.
- A dash means the library has no built-in check for that case.

## A large document

`npm run bench:document`. Median of five runs, Node.js 24.2.

The document is 3 MB of JSON: 3000 customers with two addresses each, and 4300 orders with five items, each with a nested price. That is about 112,000 values. Two broken versions have one bad quantity in the last order, or a broken email in every hundredth customer.

| Setup                             | Valid document | One error deep inside | Every hundredth email broken |
| --------------------------------- | -------------: | --------------------: | ---------------------------: |
| ArkType                           |         1.3 ms |                 15 ms |                        14 ms |
| Typia                             |         2.4 ms |                5.8 ms |                       3.3 ms |
| nominal-types `n.object()`        |         5.6 ms |                5.5 ms |                       5.5 ms |
| nominal-types + ArkType adapter   |         4.5 ms |                 15 ms |                        14 ms |
| Zod                               |         6.8 ms |                7.0 ms |                       6.8 ms |
| Valibot                           |         7.1 ms |                7.2 ms |                       7.2 ms |
| nominal-types + Zod adapter       |         9.1 ms |                 13 ms |                       9.4 ms |
| nominal-types + Valibot adapter   |          12 ms |                 15 ms |                        15 ms |
| class-validator                   |         105 ms |                103 ms |                       105 ms |
| nominal-types + class-validator   |         110 ms |                111 ms |                       109 ms |
| nominal-types + ArkType, `n.of()` |         110 ms |                111 ms |                       201 ms |

Only the nominal-types rows build instances. `n.object()` builds one for each of the 112,000 values. The ArkType adapter builds one for each `toArk()` field.

## One ArkType object

An object with a UUID, an email and a count:

| Setup                               |   Time |
| ----------------------------------- | -----: |
| ArkType alone, plain values         | 100 ns |
| the ArkType adapter, with instances | 256 ns |
| `n.of()` fields inside ArkType      | 1.9 µs |

## In a NestJS app

`npm run bench:nest`. Median of five requests, Node.js 24.2.

The same 3 MB document is posted as a JSON body to a NestJS 12 app on Fastify. Each setup runs in a process of its own.

- class-validator DTOs go through `ValidationPipe({ transform: true })`.
- The other setups go through `@Body({ schema })` and Nest's `StandardSchemaValidationPipe`.
- The last two rows register 1000 other DTO classes in the same app.

| Setup                                                 |  Valid | One error deep inside | Every hundredth email broken |
| ----------------------------------------------------- | -----: | --------------------: | ---------------------------: |
| ArkType                                               |  21 ms |                 33 ms |                        32 ms |
| Typia                                                 |  24 ms |                 25 ms |                        23 ms |
| nominal-types + ArkType adapter                       |  24 ms |                 35 ms |                        33 ms |
| nominal-types `n.object()`                            |  26 ms |                 24 ms |                        24 ms |
| Zod                                                   |  26 ms |                 27 ms |                        26 ms |
| Valibot                                               |  27 ms |                 27 ms |                        26 ms |
| class-validator                                       | 129 ms |                122 ms |                       123 ms |
| nominal-types + ArkType, `n.of()`                     | 135 ms |                129 ms |                       222 ms |
| nominal-types + class-validator                       | 141 ms |                131 ms |                       132 ms |
| class-validator, with 1000 other DTOs in the app      |  1.1 s |                 1.1 s |                        1.1 s |
| nominal-types + class-validator, with 1000 other DTOs |  1.1 s |                 1.1 s |                        1.1 s |

About 20 ms of every request is Fastify reading the body and parsing the JSON.

## See also

- [Performance](../explanation/performance.md)
- [Choosing how to check input](../explanation/choosing-an-approach.md)

[← Reference](README.md)
