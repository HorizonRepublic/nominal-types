# TypeScript types

Every type the package exports, for code that names them. Import them with `import type`. Terms are explained in the [glossary](glossary.md).

## Types for your own code

| Type              | Description                                                                |
| ----------------- | -------------------------------------------------------------------------- |
| `ValueOf<Schema>` | What a schema gives, such as the value type of an `objectOf()` schema.     |
| `InputOf<Schema>` | What a schema accepts as input.                                            |
| `Parsed<Value>`   | The result of `parse()`: `{ ok: true, value }` or `{ ok: false, issues }`. |

Example:

```ts
import { AnyString, Email, objectOf, PositiveInteger, schemaOf } from '@horizon-republic/nominal-types';
import type { InputOf, Parsed, ValueOf } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const CreateOrder = objectOf({
  customer: Email,
  sku: Sku,
  quantity: PositiveInteger,
  note: schemaOf(AnyString).optional(),
});

type CreateOrderInput = InputOf<typeof CreateOrder>; // { customer: string | Email; …; note?: string }
type CreateOrderValue = ValueOf<typeof CreateOrder>; // { customer: Email; sku: Sku; quantity: PositiveInteger; note?: AnyString }

const input: CreateOrderInput = { customer: 'jane@example.com', sku: 'ABC-1234', quantity: 2 };
const result: Parsed<CreateOrderValue> = CreateOrder.parse(input);
```

## Type classes and instances

| Type                                   | Description                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `NominalType<Name, Schema, Instance?>` | A class returned by `Nominal()`.                                                                              |
| `SubtypeOf<Parent, Name>`              | A class returned by `subtype()`.                                                                              |
| `VariantOf<Source, Name>`              | A class returned by `variant()`.                                                                              |
| `VariantInstance<Source, Name>`        | An instance of a variant: the methods of `Source`, a brand of its own.                                        |
| `AnyNominalType`                       | Any nominal type class, for code that takes types in general.                                                 |
| `NominalInstance<Name, Value>`         | What every instance offers: `value`, `equals()`, `toJSON()`, `toString()`.                                    |
| `ObjectInstance<Name, Input, Value>`   | An instance of a type built on `objectOf()`: a getter per field and `copyWith()`.                             |
| `ObjectCopy<Input>`                    | The `copyWith()` method alone.                                                                                |
| `ObjectRule<Input, Value>`             | What `Nominal()` needs of an `objectOf()` schema to add getters: `keys` and `strict()`.                       |
| `NominalOptions`                       | The options of `Nominal()`, `subtype()` and `variant()`. See [`NominalOptions`](declaring.md#nominaloptions). |
| `Immutable<Value>`                     | `Value` with its plain objects and arrays read-only all the way down. The type of `value`.                    |

## Brands

| Type                  | Description                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `Brand<Name>`         | The compile-time marker that keeps types apart. A subtype carries its own and its parent's. |
| `Branded<Names>`      | The part of an instance that holds its brands.                                              |
| `BrandsOf<Instance>`  | The brands an instance carries.                                                             |
| `Unbranded<Instance>` | An instance type without its brand.                                                         |

`Branded`, `BrandsOf` and `Unbranded` let declaration files name the instance of a type declared without a class of its own, such as a variant.

## Rules and schemas

| Type                            | Description                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NominalSchema<Input, Value>`   | What `Nominal()`, `subtype()` and `variant()` take as a rule: a Standard Schema that answers synchronously.                  |
| `PatternSchema`                 | The class `matching()` returns. See [`PatternSchema` and `PredicateSchema`](declaring.md#patternschema-and-predicateschema). |
| `PredicateSchema<Value>`        | The class `satisfying()` returns.                                                                                            |
| `TypeSchema<Input, Output>`     | The class `schemaOf()` returns. See [`TypeSchema`](schemas.md#typeschema).                                                   |
| `ArrayOptions`                  | The options of `array()`. See [`ArrayOptions`](schemas.md#arrayoptions).                                                     |
| `NominalTarget`                 | A nominal type or a `schemaOf()` schema: what adapters take.                                                                 |
| `TargetValue<Target>`           | What a `NominalTarget` gives: an instance, or what the schema gives.                                                         |
| `StandardProps<Input, Output>`  | The shape of `['~standard']`: a Standard Schema with a synchronous `validate`, and a Standard JSON Schema.                   |
| `StandardSchema<Input, Output>` | A plain object with `['~standard']`.                                                                                         |

## Objects

| Type                          | Description                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `ObjectSchema<Input, Output>` | The class `objectOf()` returns. See [`ObjectSchema`](schemas.md#objectschema).           |
| `ObjectFields`                | What `objectOf()` takes: each key to a nominal type, a schema or a Standard Schema.      |
| `ObjectInput<Fields>`         | What an `objectOf()` schema accepts. Fields that accept `undefined` are optional.        |
| `ObjectValue<Fields>`         | What an `objectOf()` schema gives. Fields that accept `undefined` are optional.          |
| `TextInput<Input>`            | What a `fromEnv()` schema accepts: each field's input or a string, every field optional. |

## Constraints

| Type                       | Description                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `Constraint<Fields>`       | The class `constraint()` returns. See [`Constraint` class](schemas.md#constraint-class). |
| `AnyConstraint`            | Any constraint, whatever fields it lists.                                                |
| `ConstraintOptions<Key>`   | The options of `constraint()`: `path` and `message`.                                     |
| `ConstraintField`          | What a listed field can be: a nominal type, a `schemaOf()` schema or a Standard Schema.  |
| `ConstraintInput<Field>`   | What one listed field accepts.                                                           |
| `ConstraintInputs<Fields>` | What the constraint accepts: an object with an input per listed field.                   |
| `ConstraintValue<Field>`   | The value `check` gets for one field.                                                    |
| `ConstraintValues<Fields>` | The values `check` gets, one per listed field.                                           |
| `ConstraintVerdict`        | What `check` returns: `boolean \| string`.                                               |

[← Reference](README.md)
