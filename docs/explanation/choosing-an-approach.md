# Choosing how to check input

There is more than one way to check a request body, a message or a config with nominal types. They all give you the same thing in the end: valid values, typed as nominal types. They differ in who describes the object, how fast it runs and how the code reads.

This page lists the ways, says which one we recommend, and when another one fits better.

## The short answer

| You are checking                                    | Recommended                                       | Guide                                                    |
| --------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| a request body, a message or a config               | `objectOf()`                                      | [objectOf()](../guides/objects.md)                       |
| the same, in a project that uses ArkType            | an ArkType schema with `toArk()` and `fromArk()`  | [ArkType](../guides/arktype.md)                          |
| the same, in a project that uses Zod or Valibot     | their schemas with `toZod()` or `toValibot()`     | [Zod](../guides/zod.md), [Valibot](../guides/valibot.md) |
| a route parameter or a query value in NestJS        | `NominalPipe`, or `{ schema: Type }` on NestJS 12 | [NestJS](../guides/nestjs.md)                            |
| a value with behaviour of its own, such as a stay   | a type whose rule is `objectOf()`                 | [objectOf()](../guides/objects.md#making-a-value-object) |
| DTOs in a project that already uses class-validator | `@NominalField()`                                 | [class-validator](../guides/class-validator.md)          |
| one value, such as an email from a form             | `Email.parse(input)`                              | [Validating input](../guides/validating-input.md)        |

Using nominal types adds little time to the library that checks the rest. The numbers are at the [end of this page](#what-each-way-costs).

## Checking an object

A nominal type checks one value. Something else has to say which fields an object has. You have five choices.

### objectOf() (recommended)

```ts
import { AnyString, Email, objectOf, PositiveInteger, schemaOf } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';

export const CreateOrder = objectOf({
  email: Email,
  quantity: PositiveInteger,
  note: schemaOf(AnyString).optional(),
});
export type CreateOrder = ValueOf<typeof CreateOrder>;
```

Use it when you have no validation library, or for new code:

- no other dependency, one schema for fields, rules across fields and JSON Schema;
- every field comes out as an instance, as fast as Zod or Valibot give plain values;
- a Standard Schema, so `NominalPipe`, NestJS 12, tRPC and others take it.

It doesn't cover unions of different object shapes, recursive schemas or transforms. See [How to check an object with objectOf()](../guides/objects.md).

### An ArkType schema with the adapter

```ts
import { type } from 'arktype';
import { toArk, fromArk } from '@horizon-republic/nominal-types/adapters/arktype';
import type { ValueOf } from '@horizon-republic/nominal-types';
import { Email, PositiveInteger } from '@horizon-republic/nominal-types';

export const CreateOrder = fromArk(
  type({ email: toArk(Email), quantity: toArk(PositiveInteger), 'note?': 'string' }),
);
export type CreateOrder = ValueOf<typeof CreateOrder>;
```

Use it when the project already uses ArkType, or needs what `objectOf()` doesn't cover: unions, recursion, transforms. It is:

- close to ArkType alone, see the numbers below;
- one place for the shape of the object, the types of its fields, rules across fields and JSON Schema;
- a Standard Schema, so NestJS 12, tRPC and other libraries take it as it is.

The value is a plain object whose fields are instances: `order.email` is an `Email`.

### A class-validator DTO with `@NominalField()`

```ts
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

export class CreateOrderDto {
  @NominalField(Email)
  public email!: Email;
}
```

Use it when the project already checks its DTOs with class-validator. Nominal types add only a few percent to class-validator's own time.

For new code, prefer ArkType. class-validator itself is slow, and it gets slower as the app registers more DTO classes: the same body takes 0.13 s in a small app and 1.1 s in an app with a thousand DTOs.

### A Zod or Valibot schema with the adapter

In a project that uses Zod or Valibot, put `toZod(Type)` or `toValibot(Type)` into their schemas. The values come out as instances, at about 1.3 to 1.6 times the library's own time on a large document. See [Zod](../guides/zod.md) and [Valibot](../guides/valibot.md).

### A schema of another library, with `schemaOf()`

```ts
const invitation = type({ email: schemaOf(Email) });
```

`schemaOf()` works in any library that accepts a Standard Schema inside its own schemas. It needs no adapter, and it is slower: in ArkType about 20 times slower than the adapter, because the library runs every such field through its slow path.

Use it where no adapter exists yet, or in a schema that runs rarely, such as a config read once at startup.

## Giving an object behaviour

Sometimes an object is a value of its own: a date range, an amount with its currency, an occupancy. It has rules across its fields and methods that belong to it. Make it a nominal type on `objectOf()`, with the rules as constraints:

```ts
import { constraint, Nominal, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

export class Occupancy extends Nominal(
  'booking.Occupancy',
  objectOf({ guests: PositiveInteger, capacity: PositiveInteger }, withinCapacity),
) {
  public get free(): number {
    return this.capacity.value - this.guests.value;
  }
}

new Occupancy({ guests: 2, capacity: 3 }).copyWith({ guests: 3 }).free; // 0
```

The class gets a getter for each field and `copyWith()`, and its value is frozen.

Don't make every request body a class this way. A body is checked once and taken apart. A plain object from `objectOf()` is simpler to use, and its fields are instances already.

## Rules across fields

A rule that reads two fields, such as "the end comes after the start", is a `constraint()`. Write it once and attach it wherever the object is checked:

| Where             | How                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------- |
| an ArkType schema | `fromArk(type({ … }), rule)` or `constrainArk(type({ … }), rule)` for a nested object |
| a type of its own | `Nominal('Name', rule)`                                                               |

See [How to check one field against another](../guides/checking-fields-together.md).

## What each way costs

A 3 MB JSON body with 112,000 values, posted to a NestJS 12 app on Fastify. Each setup runs in a process of its own. Median time per request on an Apple M4 Pro, Node.js 24.2:

| Setup                                 | Valid body | Gives instances |
| ------------------------------------- | ---------: | :-------------: |
| ArkType alone                         |      21 ms |       no        |
| Typia alone                           |      24 ms |       no        |
| nominal-types + ArkType adapter       |      24 ms |       yes       |
| nominal-types `objectOf()`            |      26 ms |       yes       |
| Zod alone                             |      26 ms |       no        |
| nominal-types + ArkType, `schemaOf()` |     135 ms |       yes       |
| class-validator alone                 |     129 ms |       no        |
| nominal-types + class-validator       |     141 ms |       yes       |

About 20 ms of every row is Fastify reading the body and parsing the JSON. `objectOf()` alone, and the ArkType adapter, both turn all 112,000 values into instances at the speed of Zod and Typia, which give plain values. Inside class-validator, nominal types add a few percent.

More numbers are on the [Performance](performance.md) page.

[← Explanation](README.md)
