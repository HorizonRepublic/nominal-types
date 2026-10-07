# Performance

Is a class per value fast enough for a server? This page says what a check costs and which choices make it faster. The numbers are in [Benchmarks](../reference/benchmarks.md).

## Do you need to care?

Usually not. A type costs about as much as its own check, plus a few tens of nanoseconds to make the instance. In a typical API, reading and parsing the body take far longer.

## What makes a type slower

- More rules. Every rule in the chain runs on every value.
- A rule from another library. It adds that library's cost, and some libraries spend long on messages for a rejected value.
- A long list. Each item is checked. The length is checked first, so `array({ max })` refuses a long list before any item runs.

Rules run from the base type down and stop at the first failure. So put cheap checks, such as a regular expression, on the type, and expensive ones, such as a checksum, in a subtype.

## parse() or new

For input that may be wrong, use `parse()`. It returns the issues. `new` throws, and throwing an error costs far more than the check.

An existing instance passed to `parse()` is not checked again.

## Which way to check an object is fast

| Way                                    | Speed                                                                 |
| -------------------------------------- | --------------------------------------------------------------------- |
| `objectOf()`                           | about as fast as Zod and Valibot, which give plain values             |
| ArkType with `toArk()` and `fromArk()` | about as fast as `objectOf()`                                         |
| Zod or Valibot with its adapter        | slower than the library alone, in the same range                      |
| `schemaOf()` inside another library    | many times slower than an adapter                                     |
| class-validator with `@NominalField()` | a few percent over class-validator, which is far slower than the rest |

Inside a library that has an adapter, use the adapter, not `schemaOf()`. The library runs a `schemaOf()` field on its slow path.

class-validator also gets slower as the app registers more DTO classes, whatever the fields hold.

## Without code generation

The package generates its checks with `new Function`. Cloudflare Workers and pages with a strict Content-Security-Policy forbid that. There, the checks run without generated code: the results are the same, only slower. Nothing needs to be configured.

## See also

- [Benchmarks](../reference/benchmarks.md)
- [Choosing how to check input](choosing-an-approach.md)

[← Explanation](README.md)
