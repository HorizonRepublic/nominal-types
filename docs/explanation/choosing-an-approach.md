# Choosing how to check input

Which way of checking a request body fits your project? All the ways give valid values, typed as nominal types. They differ in who describes the object, what else you install, and how the code reads.

## The short answer

| Your project                         | Use                                                         | Guide                                                                          |
| ------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| new code, or no validation library   | `n.object()`, with `n.constraint()` for rules across fields | [n.object()](../guides/core/check-an-object.md)                                |
| already uses ArkType                 | its schemas, with `toArk()` and `fromArk()`                 | [ArkType](../guides/validators/arktype.md)                                     |
| already uses Zod or Valibot          | its schemas, with `toZod()` or `toValibot()`                | [Zod](../guides/validators/zod.md), [Valibot](../guides/validators/valibot.md) |
| already uses class-validator         | `@NominalField()` on DTO properties                         | [class-validator](../guides/validators/class-validator.md)                     |
| uses another Standard Schema library | `n.of()` inside its schemas                                 | [Standard Schema](../guides/validators/standard-schema.md)                     |

For one value, such as a query parameter, call `Type.parse(input)`. See [How to check untrusted input](../guides/core/check-input.md). In NestJS, [`NominalPipe`](../guides/frameworks/nestjs.md) does it for each parameter.

## n.object()

`n.object()` describes an object whose fields are nominal types:

```ts
import { AnyString, Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export const CreateOrder = n.object({
  customer: Email,
  sku: Sku,
  quantity: PositiveInteger,
  note: n.of(AnyString).optional(),
});

CreateOrder.parse({ customer: 'jane@example.com', sku: 'ABC-1234', quantity: 2 }).ok; // true
```

Why it is the default:

- It needs no other library.
- One schema holds the fields, the rules across fields and the JSON Schema.
- Every field comes out as an instance, and the speed matches libraries that give plain values.
- It is a [Standard Schema](../reference/glossary.md), so NestJS, tRPC and other libraries take it as it is.

Objects of several shapes, told apart by a field, use `n.union()`. Objects whose keys are data use `n.record()`, and arrays of fixed positions `n.tuple()`.

It has limits. It has no recursive schemas, no transforms and no asynchronous checks. A project that needs those uses ArkType with its adapter.

## A validator you already use

A project on ArkType, Zod or Valibot keeps its schemas. The adapter puts a nominal type into a field:

```ts
import { type } from 'arktype';
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';
import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export const CreateOrder = fromArk(
  type({ customer: toArk(Email), sku: toArk(Sku), quantity: toArk(PositiveInteger), 'note?': 'string' }),
);

CreateOrder.parse({ customer: 'jane@example.com', sku: 'ABC-1234', quantity: 2 }).ok; // true
```

You keep what the library has, such as unions and recursion in ArkType. The field gives an instance. An adapter is much faster than `n.of()` inside the same library.

## class-validator

A project that checks DTO classes with class-validator keeps them. `@NominalField()` turns a property into a nominal type:

```ts
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export class CreateOrderDto {
  @NominalField(Email)
  public customer!: Email;

  @NominalField(Sku)
  public sku!: Sku;

  @NominalField(PositiveInteger)
  public quantity!: PositiveInteger;
}
```

Nominal types add about a tenth to class-validator's own time. class-validator itself is much slower than the schema libraries, and gets slower as an app registers more DTO classes. So it is not the choice for new code.

## Any other Standard Schema library

Every nominal type is a Standard Schema. So a library that accepts Standard Schemas inside its own schemas takes `n.of(Email)` with no adapter.

It is slower than an adapter. Use it where no adapter exists, or in a schema that runs rarely, such as a config read once at startup.

## Rules across fields

A rule that reads two fields, such as "guests fit the room", is an `n.constraint()`. Write it once and attach it where the object is checked:

| Where the object is checked | How the constraint is attached                                                  |
| --------------------------- | ------------------------------------------------------------------------------- |
| `n.object()`                | `n.object({ … }, withinCapacity)`                                               |
| ArkType                     | `fromArk(type({ … }), withinCapacity)`, or `constrainArk()` for a nested object |
| Zod                         | `constrainZod(z.object({ … }), withinCapacity)`                                 |
| Valibot                     | `constrainValibot(v.object({ … }), withinCapacity)`                             |

## A value with behaviour of its own

Sometimes an object is a value of its own: a stay with guests and a capacity, an amount with its currency. It has rules across its fields and methods that belong to it. Make it a class on `n.object()`. [How to make a value object](../guides/core/make-a-value-object.md) shows how.

A request body doesn't need that. It is checked once and taken apart. A plain object from `n.object()` is simpler, and its fields are instances already.

## What each way costs

[Performance](performance.md) compares the speed of these ways. The numbers are in [Benchmarks](../reference/benchmarks.md).

## See also

- [How to check a request body with n.object()](../guides/core/check-an-object.md)
- [How to check one field against another](../guides/core/check-fields-together.md)
- [Where checks belong](where-checks-belong.md)
- [Benchmarks](../reference/benchmarks.md)

[← Explanation](README.md)
