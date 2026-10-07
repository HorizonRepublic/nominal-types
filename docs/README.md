# Documentation

Start with the [README](../README.md) for installation and a first type.

## Guides

- [Declaring types](guides/declaring-types.md): patterns, type guards, schemas from validation libraries, and behaviour on the type.
- [Building on a type](guides/building-on-types.md): `subtype()`, `extends` and `variant()`, moving values between types, and ordering rules.
- [Validating untrusted input](guides/validating-input.md): `parse()` and `is()` where bad input is expected.
- [Embedding types in other validators](guides/other-validators.md): nominal types inside ArkType, Zod and other schemas.
- [Generating JSON Schema](guides/json-schema.md): describing types to OpenAPI and documentation tools.
- [NestJS](guides/nestjs.md): validating route parameters with `NominalPipe`.

## Reference

- [Built-in types](reference/built-in-types.md): `Email`, `Uuid`, `Url` and `HttpUrl`.
- [API](reference/api.md): every function, member and type the package exports.

## Explanation

- [How it works](explanation/how-it-works.md): why classes, validating once, nominal typing and identity across copies.
- [Performance](explanation/performance.md): what each operation costs.
