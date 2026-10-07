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
| `schemaOf(Uuid).array().parse(ids)`, 1000 UUIDs | 70 µs |

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

| Setup                                 | Valid document | One error deep inside | Every hundredth email broken |
| ------------------------------------- | -------------: | --------------------: | ---------------------------: |
| ArkType                               |         1.3 ms |                 15 ms |                        14 ms |
| Typia                                 |         2.4 ms |                5.8 ms |                       3.3 ms |
| nominal-types `objectOf()`            |         5.6 ms |                5.5 ms |                       5.5 ms |
| nominal-types + ArkType adapter       |         4.5 ms |                 15 ms |                        14 ms |
| Zod                                   |         6.8 ms |                7.0 ms |                       6.8 ms |
| Valibot                               |         7.1 ms |                7.2 ms |                       7.2 ms |
| nominal-types + Zod adapter           |         9.1 ms |                 13 ms |                       9.4 ms |
| nominal-types + Valibot adapter       |          12 ms |                 15 ms |                        15 ms |
| class-validator                       |         105 ms |                103 ms |                       105 ms |
| nominal-types + class-validator       |         110 ms |                111 ms |                       109 ms |
| nominal-types + ArkType, `schemaOf()` |         110 ms |                111 ms |                       201 ms |

Only the nominal-types rows build instances. `objectOf()` builds one for each of the 112,000 values. The ArkType adapter builds one for each `toArk()` field.

## One ArkType object

An object with a UUID, an email and a count:

| Setup                               |   Time |
| ----------------------------------- | -----: |
| ArkType alone, plain values         | 100 ns |
| the ArkType adapter, with instances | 256 ns |
| `schemaOf()` fields inside ArkType  | 1.9 µs |

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
| nominal-types `objectOf()`                            |  26 ms |                 24 ms |                        24 ms |
| Zod                                                   |  26 ms |                 27 ms |                        26 ms |
| Valibot                                               |  27 ms |                 27 ms |                        26 ms |
| class-validator                                       | 129 ms |                122 ms |                       123 ms |
| nominal-types + ArkType, `schemaOf()`                 | 135 ms |                129 ms |                       222 ms |
| nominal-types + class-validator                       | 141 ms |                131 ms |                       132 ms |
| class-validator, with 1000 other DTOs in the app      |  1.1 s |                 1.1 s |                        1.1 s |
| nominal-types + class-validator, with 1000 other DTOs |  1.1 s |                 1.1 s |                        1.1 s |

About 20 ms of every request is Fastify reading the body and parsing the JSON.

## See also

- [Performance](../explanation/performance.md)
- [Choosing how to check input](../explanation/choosing-an-approach.md)

[← Reference](README.md)
