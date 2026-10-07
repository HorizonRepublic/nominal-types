# Documentation

Start with the [README](../README.md) for installation, or with [Your first type](tutorials/your-first-type.md) for a guided first run. The pages are grouped the [Diátaxis](https://diataxis.fr) way, by what you need at the moment.

## Tutorials

Lessons that take you from nothing to a working result.

- [Your first type](tutorials/your-first-type.md)
  - [Set up a project](tutorials/your-first-type.md#set-up-a-project)
  - [Declare the type](tutorials/your-first-type.md#declare-the-type)
  - [Build a value](tutorials/your-first-type.md#build-a-value)
  - [Try an invalid value](tutorials/your-first-type.md#try-an-invalid-value)
  - [Let the compiler keep it apart](tutorials/your-first-type.md#let-the-compiler-keep-it-apart)
  - [Give it behaviour](tutorials/your-first-type.md#give-it-behaviour)
  - [Check input that may be wrong](tutorials/your-first-type.md#check-input-that-may-be-wrong)
  - [Add a narrower type](tutorials/your-first-type.md#add-a-narrower-type)
  - [What we built](tutorials/your-first-type.md#what-we-built)

## How-to guides

Recipes for a task you already have in mind.

- [How to declare a type](guides/declaring-types.md)
  - [Declaring with a pattern](guides/declaring-types.md#declaring-with-a-pattern)
  - [Declaring with a type guard](guides/declaring-types.md#declaring-with-a-type-guard)
  - [Declaring with a schema from another library](guides/declaring-types.md#declaring-with-a-schema-from-another-library)
  - [Giving the type behaviour](guides/declaring-types.md#giving-the-type-behaviour)
- [How to build on a type](guides/building-on-types.md)
  - [Choosing how](guides/building-on-types.md#choosing-how)
  - [Starting from a base type](guides/building-on-types.md#starting-from-a-base-type)
  - [Adding a stricter rule](guides/building-on-types.md#adding-a-stricter-rule)
  - [Giving a type a second name](guides/building-on-types.md#giving-a-type-a-second-name)
  - [Adding behaviour without a new type](guides/building-on-types.md#adding-behaviour-without-a-new-type)
  - [Accepting different values with the same behaviour](guides/building-on-types.md#accepting-different-values-with-the-same-behaviour)
  - [Moving a value between types](guides/building-on-types.md#moving-a-value-between-types)
  - [Ordering the rules](guides/building-on-types.md#ordering-the-rules)
- [How to validate untrusted input](guides/validating-input.md)
- [How to use a type inside another validator](guides/other-validators.md)
- [How to generate JSON Schema](guides/json-schema.md)
  - [Getting a type's schema](guides/json-schema.md#getting-a-types-schema)
  - [Making your own type describable](guides/json-schema.md#making-your-own-type-describable)
  - [Keeping the schema and the type in step](guides/json-schema.md#keeping-the-schema-and-the-type-in-step)
- [How to validate NestJS route parameters](guides/nestjs.md)
  - [Validating every parameter](guides/nestjs.md#validating-every-parameter)
  - [Validating one parameter](guides/nestjs.md#validating-one-parameter)
  - [Shaping the error response](guides/nestjs.md#shaping-the-error-response)
  - [Validating headers](guides/nestjs.md#validating-headers)

## Reference

What every export and built-in type does, in full.

- [API](reference/api.md)
  - [Functions](reference/api.md#functions)
  - [Static members](reference/api.md#static-members)
  - [Instance members](reference/api.md#instance-members)
  - [NominalError](reference/api.md#nominalerror)
  - [Messages](reference/api.md#messages)
  - [JSON Schema](reference/api.md#json-schema)
  - [Types](reference/api.md#types)
- [Built-in types](reference/types/README.md)
  - [Strings](reference/types/string.md)
    - [AnyString](reference/types/string.md#anystring)
    - [Email](reference/types/string.md#email)
    - [Uuid](reference/types/string.md#uuid)
    - [Url](reference/types/string.md#url)
    - [HttpUrl](reference/types/string.md#httpurl)
  - [Numbers](reference/types/number.md)
    - [AnyNumber](reference/types/number.md#anynumber)
    - [FiniteNumber](reference/types/number.md#finitenumber)
    - [Sign types](reference/types/number.md#sign-types)
    - [Integer](reference/types/number.md#integer)
    - [Sized integers](reference/types/number.md#sized-integers)
    - [Float32](reference/types/number.md#float32)
  - [Big integers](reference/types/bigint.md)
    - [AnyBigInt](reference/types/bigint.md#anybigint)
    - [Sign types](reference/types/bigint.md#sign-types)
    - [Int64 and Uint64](reference/types/bigint.md#int64-and-uint64)
  - [Booleans](reference/types/boolean.md)
    - [AnyBoolean](reference/types/boolean.md#anyboolean)

## Explanation

Why the package works the way it does.

- [How it works](explanation/how-it-works.md)
  - [Classes rather than brands](explanation/how-it-works.md#classes-rather-than-brands)
  - [Behaviour on the type](explanation/how-it-works.md#behaviour-on-the-type)
  - [Validated once](explanation/how-it-works.md#validated-once)
  - [Nominal at compile time](explanation/how-it-works.md#nominal-at-compile-time)
  - [One identity across copies](explanation/how-it-works.md#one-identity-across-copies)
- [Type hierarchy](explanation/type-hierarchy.md)
  - [Why base types](explanation/type-hierarchy.md#why-base-types)
  - [Why three ways to build on a type](explanation/type-hierarchy.md#why-three-ways-to-build-on-a-type)
  - [Why limits are new types](explanation/type-hierarchy.md#why-limits-are-new-types)
  - [Why zero splits the sign types](explanation/type-hierarchy.md#why-zero-splits-the-sign-types)
  - [Why big integers travel as strings](explanation/type-hierarchy.md#why-big-integers-travel-as-strings)
- [Performance](explanation/performance.md)
  - [Measurements](explanation/performance.md#measurements)
  - [How a chain runs](explanation/performance.md#how-a-chain-runs)
