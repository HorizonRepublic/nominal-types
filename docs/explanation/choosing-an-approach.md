# Choosing how to check input

There is more than one way to check a request body, a message or a config with nominal types. They all give you the same thing in the end: valid values, typed as nominal types. They differ in who describes the object, how fast it runs and how the code reads.

This page lists the ways, says which one we recommend, and when another one fits better.

## The short answer

| You are checking                                    | Recommended                                        | Guide                                                             |
| --------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| a request body, a message or a config               | an ArkType schema with `arkOf()` and `arkSchema()` | [ArkType](../guides/arktype.md)                                   |
| a route parameter or a query value in NestJS        | `NominalPipe`, or `{ schema: Type }` on NestJS 12  | [NestJS](../guides/nestjs.md)                                     |
| a value with behaviour of its own, such as a range  | a type whose rule is a `constraint()` or a schema  | [Checking fields together](../guides/checking-fields-together.md) |
| DTOs in a project that already uses class-validator | `@NominalField()`                                  | [class-validator](../guides/class-validator.md)                   |
| one value, such as an email from a form             | `Email.parse(input)`                               | [Validating input](../guides/validating-input.md)                 |

Using nominal types adds little time to the library that checks the rest. The numbers are at the [end of this page](#what-each-way-costs).

## Checking an object

A nominal type checks one value. Something else has to say which fields an object has. You have three choices.

### An ArkType schema with the adapter (recommended)

```ts
import { type } from 'arktype';
import { arkOf, arkSchema } from '@horizon-republic/nominal-types/adapters/arktype';
import type { ValueOf } from '@horizon-republic/nominal-types';
import { Email, PositiveInteger } from '@horizon-republic/nominal-types';

export const CreateOrder = arkSchema(
  type({ email: arkOf(Email), quantity: arkOf(PositiveInteger), 'note?': 'string' }),
);
export type CreateOrder = ValueOf<typeof CreateOrder>;
```

Use it for new code. It is:

- the fastest way that gives you instances: close to ArkType alone, see the numbers below;
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

### A schema of another library, with `schemaOf()`

```ts
const invitation = type({ email: schemaOf(Email) });
```

`schemaOf()` works in any library that accepts a Standard Schema inside its own schemas. It needs no adapter, and it is slower: in ArkType about 13 times slower than the adapter, because the library runs every such field through its slow path.

Use it where no adapter exists yet, or in a schema that runs rarely, such as a config read once at startup.

## Giving an object behaviour

Sometimes an object is a value of its own: a date range, an amount with its currency, an occupancy. It has rules across its fields and methods that belong to it. Make it a nominal type:

```ts
import { constraint, Nominal, PositiveInteger } from '@horizon-republic/nominal-types';

export class Occupancy extends Nominal(
  'Occupancy',
  constraint(
    { guests: PositiveInteger, capacity: PositiveInteger },
    ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
    { path: 'guests' },
  ),
) {
  public get free(): number {
    return this.value.capacity.value - this.value.guests.value;
  }
}
```

The rule can be a `constraint()`, as here, when the object has only the fields the constraint lists. For an object with more fields, use an ArkType schema as the rule: `Nominal('Booking', arkSchema(type({ … }), withinCapacity))`.

You get a class: `instanceof` works, the value is frozen, and the fields are read through `value`, such as `occupancy.value.guests`.

Don't make every request body a class this way. A body is checked once and taken apart. A plain object from `arkSchema()` is simpler to use, and its fields are instances already.

## Rules across fields

A rule that reads two fields, such as "the end comes after the start", is a `constraint()`. Write it once and attach it wherever the object is checked:

| Where             | How                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------ |
| an ArkType schema | `arkSchema(type({ … }), rule)` or `arkObject(type({ … }), rule)` for a nested object |
| a type of its own | `Nominal('Name', rule)`                                                              |

See [How to check one field against another](../guides/checking-fields-together.md).

## What each way costs

A 3 MB JSON body with 112,000 values, posted to a NestJS 12 app on Fastify. Each setup runs in a process of its own. Median time per request on an Apple M4 Pro, Node.js 24.2:

| Setup                                 | Valid body | Gives instances |
| ------------------------------------- | ---------: | :-------------: |
| ArkType alone                         |      21 ms |       no        |
| Zod alone                             |      27 ms |       no        |
| nominal-types + ArkType adapter       |      29 ms |       yes       |
| nominal-types + ArkType, `schemaOf()` |     128 ms |       yes       |
| nominal-types + class-validator       |     140 ms |       yes       |
| class-validator alone                 |     129 ms |       no        |

About 20 ms of every row is Fastify reading the body and parsing the JSON. With the adapter, nominal types add about 8 ms to ArkType for 112,000 checked values turned into instances. Inside class-validator, they add a few percent.

More numbers are on the [Performance](performance.md) page.

[← Explanation](README.md)
