# Performance

Is a class per value fast enough for a server? This page says what a check costs, which choices make it faster and how much the package adds to a bundle. The numbers are in [Benchmarks](../reference/benchmarks.md). They come from Node.js on an Apple M4 Pro.

## Do you need to care?

Usually not. A type costs about as much as its own check, plus a few tens of nanoseconds to make the instance. In a typical API, reading and parsing the body take far longer.

Three costs do add up: rejecting with `new`, writing many instances as JSON, and holding many instances in memory.

## What makes a type slower

- More rules. Every rule in the chain runs on every value.
- A rule from another library. It adds that library's cost, and some libraries spend long on messages for a rejected value.
- A long list. Each item is checked. The length is checked first, so `array({ max })` refuses a long list before any item runs.

Rules run from the base type down and stop at the first failure. So put cheap checks, such as a regular expression, on the type, and expensive ones, such as a checksum, in a subtype.

## parse() or new

For input that may be wrong, use `parse()`. It returns the issues.

`new` throws a `NominalError` for a bad value. Throwing and catching an error costs about 5 µs. `parse()` rejects the same value in 0.03 to 0.3 µs. So `new` on input from outside is 20 to 160 times slower whenever the input is bad.

| Call              | Bad value |
| ----------------- | --------: |
| `Integer.parse()` |   0.03 µs |
| `Email.parse()`   |   0.23 µs |
| `new Integer()`   |    5.1 µs |
| `new Email()`     |    5.3 µs |

Use `parse()` at the edges of your app, and `new` for values your own code makes.

An existing instance passed to `parse()` is not checked again.

## A yes or no without an instance

When you only need to know whether a value is valid, call `accepts()`. It runs the same rules as `parse()`, but it makes no instance, no result object and no issues:

| Check               | `accepts()` | `parse()` |
| ------------------- | ----------: | --------: |
| `Integer`, valid    |        7 ns |     33 ns |
| `Email`, valid      |       61 ns |     87 ns |
| an order, valid     |     0.67 µs |    2.7 µs |
| an order, bad email |     0.07 µs |    3.2 µs |

An object stops at the first field that fails, so a bad value is cheap. See [`Type.accepts()`](../reference/type-members.md#accepts) and [`schema.accepts()`](../reference/schemas.md#accepts).

## Writing responses as JSON

`JSON.stringify()` calls `toJSON()` on every instance. That makes an object full of instances about 3.5 times slower to write than the same plain values.

A schema writes the values it gave faster. Its [`stringify()`](../reference/schemas.md#stringify) writes each instance's value straight to text, with no `toJSON()` call and no plain copy:

| How an order with 20 items is written         |    Time |
| --------------------------------------------- | ------: |
| `JSON.stringify(plain values)`, for reference | 1.22 µs |
| `JSON.stringify(parsed)`                      | 4.22 µs |
| `JSON.stringify(n.plain(parsed))`             | 2.62 µs |
| `JSON.stringify(Order.toPlain(parsed))`       | 1.54 µs |
| `Order.stringify(parsed)`                     | 0.58 µs |

`stringify()` beats `JSON.stringify()` even on plain values: about twice as fast for one order, and a little faster for a 3 MB document. See [Benchmarks](../reference/benchmarks.md#writing-json-with-stringify).

- To write a value from a schema yourself, call the schema's `stringify()`.
- When a framework writes the response for you, give it the schema's [`toPlain()`](../reference/schemas.md#toplain).
- For a value that doesn't come from one schema, call [`n.plain()`](../reference/schemas.md#nplain).
- In NestJS, put [`@NominalResponse(schema)`](../guides/frameworks/nestjs.md#send-responses-fast) on the route. For routes without a schema, [`NominalSerializerInterceptor`](../guides/frameworks/nestjs.md#send-instances-in-responses) converts the response before class-transformer runs.
- In Fastify, register the [`fastifyNominal` plugin](../guides/frameworks/fastify.md#send-responses) and give the route's response a schema. The plugin writes the response with `stringify()`.

## Memory

Each value of a parsed object is an instance, an object of its own. An order with 20 items takes about 3.4 KB on the heap once parsed, against 1.3 KB for the same JSON as plain values: about 2.6 times more.

This matters when you keep many parsed values, such as a cache or a large list in memory. Keep them as plain values there, with `toPlain()`, and parse them again where you need the instances.

## Which way to check an object is fast

| Way                                    | Speed                                                                 |
| -------------------------------------- | --------------------------------------------------------------------- |
| `n.object()`                           | about as fast as Zod and Valibot, which give plain values             |
| ArkType with `toArk()` and `fromArk()` | about as fast as `n.object()`                                         |
| Zod or Valibot with its adapter        | slower than the library alone, in the same range                      |
| `n.of()` inside another library        | many times slower than an adapter                                     |
| class-validator with `@NominalField()` | about a tenth over class-validator, which is far slower than the rest |

Inside a library that has an adapter, use the adapter, not `n.of()`. The library runs an `n.of()` field on its slow path.

class-validator also gets slower as the app registers more DTO classes, whatever the fields hold.

## Without code generation

The package generates its checks with `new Function`. Cloudflare Workers and pages with a strict Content-Security-Policy forbid that. There, the checks run without generated code. The results are the same, and nothing needs to be configured.

The checks are slower there. Parsing an order with 20 items takes 4.1 µs instead of 2.5 µs, about 1.7 times as long. A single value loses a few nanoseconds: an email takes 97 ns instead of 91 ns. A schema's `stringify()` writes `JSON.stringify(schema.toPlain(value))` there: 2.4 µs for the order instead of 0.58 µs, still faster than `JSON.stringify()` of the instances.

## Bundle size

A [bundler](../reference/glossary.md), such as esbuild, Vite or webpack, keeps only the types and functions your code imports. These are the sizes of bundles minified by esbuild. Gzipped is the size sent over the network when the server compresses it.

| Your code imports                                       | Minified | Gzipped  |
| ------------------------------------------------------- | -------- | -------- |
| `Uuid`                                                  | 24 KB    | 8.6 KB   |
| `Email`                                                 | 24 KB    | 8.6 KB   |
| `Integer`                                               | 23 KB    | 8.1 KB   |
| `n.object()` with `Uuid`, `Email` and `PositiveInteger` | 55 KB    | 19 KB    |
| `PlainDate` from `/temporal`                            | 24 KB    | 8.6 KB   |
| `Uuid` and the adapter for a validator or a framework   | 25–26 KB | 9 KB     |
| `Uuid` and the adapter for a database                   | 33 KB    | 11–12 KB |
| everything                                              | 87 KB    | 30 KB    |

About 22 KB of each bundle is the part every type shares. Each built-in type adds about 1 KB. `n.of()` and `n.object()` add the schema code, the JSON writer included.

The bundler leaves parts out only when your code loads the package with `import`. With `require()`, the bundle holds the whole package.

## See also

- [Benchmarks](../reference/benchmarks.md)
- [Choosing how to check input](choosing-an-approach.md)

[← Explanation](README.md)
