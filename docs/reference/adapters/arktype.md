# arktype

Entry point: `@horizon-republic/nominal-types/adapters/arktype`. Needs `arktype` 2.2 or later.

| Export           | Kind     | Use it for                                                          |
| ---------------- | -------- | ------------------------------------------------------------------- |
| `toArk()`        | function | a field of an ArkType schema that holds a nominal type              |
| `constrainArk()` | function | [constraints](../schemas.md) on an ArkType object, wherever it sits |
| `fromArk()`      | function | the whole schema: check, build instances, run constraints           |
| `ArkSchema`      | class    | what `fromArk()` returns                                            |
| `ArkField`       | type     | what `toArk()` returns                                              |
| `Built`          | type     | the value `fromArk()` gives for an ArkType definition               |

## toArk()

```ts
function toArk<Target extends AnyNominalType>(target: Target): ArkField<Target>;
```

| Parameter | Type         | Description                  |
| --------- | ------------ | ---------------------------- |
| `target`  | nominal type | the type the field must hold |

Returns an ArkType node. ArkType checks it with the type's own rules and messages. The node gives the plain value; `fromArk()` builds the instance.

Use ArkType's syntax around it:

| You want                   | Write                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------- |
| an optional field          | `'backup?': toArk(Email)`                                                           |
| a value or `null`          | `toArk(Email).or('null')`                                                           |
| a list                     | `toArk(Uuid).array()`                                                               |
| a tuple                    | `[toArk(Uuid), toArk(PositiveInteger)]`                                             |
| a record                   | `type({ '[string]': toArk(Email) })`                                                |
| one type or another        | `toArk(Email).or(toArk(Uuid))`                                                      |
| objects of different kinds | `type({ kind: "'email'", to: toArk(Email) }).or({ kind: "'id'", to: toArk(Uuid) })` |
| a value cleaned first      | `type('string.trim').pipe(toArk(Email))`                                            |

## fromArk()

```ts
function fromArk<Ark extends Type>(ark: Ark, ...constraints: AnyConstraint[]): ArkSchema<Ark['inferIn'], Built<Ark['t']>>;
```

| Parameter     | Type              | Description                             |
| ------------- | ----------------- | --------------------------------------- |
| `ark`         | ArkType type      | the schema, with `toArk()` fields       |
| `constraints` | `AnyConstraint[]` | optional; constraints on the top object |

Returns an `ArkSchema`. It checks input in this order:

1. ArkType checks the whole input.
2. One pass builds an instance for every `toArk()` field.
3. The constraints run: those given here and those `constrainArk()` attached inside.

Constraints run only when ArkType accepted the whole input.

Throws `TypeError` when building the schema if a `toArk()` node sits where its branch can't be told at runtime:

| Not supported                              | Example                                                       |
| ------------------------------------------ | ------------------------------------------------------------- |
| a morph after `toArk()`                    | `toArk(Email).pipe((email) => email)`                         |
| a union of objects without a literal field | `type({ to: toArk(Email) }).or({ id: toArk(Uuid) })`          |
| a union of two arrays                      | `toArk(Email).array().or(toArk(Uuid).array())`                |
| two index signatures                       | `type({ '[string]': toArk(Email), '[symbol]': toArk(Uuid) })` |

The message names the case, for example `TypeError: fromArk: a morph holds a nominal type in a form that can't be told apart at runtime; …`.

## ArkSchema

| Member         | Type                                 | Description                                                                     |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| `parse(input)` | `(input: unknown) => Parsed<Output>` | `{ ok: true, value }` or `{ ok: false, issues }`; never throws                  |
| `ark`          | ArkType `Type`                       | the ArkType schema; called alone, it gives plain values and runs no constraints |
| `~standard`    | Standard Schema props                | a [Standard Schema](../glossary.md) and Standard JSON Schema                    |

Each issue is `{ message, path? }`. The message is the type's own, as `Email.parse()` gives it.

JSON Schema targets: `draft-2020-12`, `draft-07` and `openapi-3.0`. Each `toArk()` field is described by its type: pattern, format, limits, example. Ask with `CreateOrder['~standard'].jsonSchema.input({ target: 'openapi-3.0' })`. Another target throws `TypeError: JSON Schema target <name> is not supported`.

To name the value's type, use `ValueOf`: `type CreateOrder = ValueOf<typeof CreateOrder>`.

## constrainArk()

```ts
function constrainArk<Ark extends Type>(ark: Ark, ...constraints: AnyConstraint[]): Ark;
```

| Parameter     | Type                | Description               |
| ------------- | ------------------- | ------------------------- |
| `ark`         | ArkType object type | the object to check       |
| `constraints` | `AnyConstraint[]`   | the constraints to attach |

Returns the same ArkType type with the constraints attached. `fromArk()` runs them on that object wherever it sits: at the top, in another object, in an array, in an optional field or in a union branch. Issue paths start at the top of the input.

Throws `TypeError: constrainArk: constraints attach to an ArkType object type` when `ark` is not an object.

## Example

A request body:

```ts
import { type } from 'arktype';
import { fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
import { AnyString, Email, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const CreateOrder = fromArk(
  type({ customer: toArk(Email), sku: toArk(Sku), quantity: toArk(PositiveInteger), 'note?': 'string' }),
);

const good = CreateOrder.parse({ customer: 'jane@example.com', sku: 'TEA-0042', quantity: 2 });
good.ok && good.value.sku instanceof Sku; // true

CreateOrder.parse({ customer: 'jane', sku: 'TEA-0042', quantity: 0 });
// { ok: false, issues: [
//   { message: 'must be an email address (was a string of 4 characters)', path: ['customer'] },
//   { message: 'must be a positive integer (was 0)', path: ['quantity'] } ] }
```

A constraint on a nested object:

```ts
import { type } from 'arktype';
import { constrainArk, fromArk, toArk } from '@horizon-republic/nominal-types/adapters/arktype';
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = n.constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests.value <= capacity.value || 'must not exceed the capacity',
  { path: 'guests' },
);

const Stay = constrainArk(
  type({ guests: toArk(PositiveInteger), capacity: toArk(PositiveInteger) }),
  withinCapacity,
);
const CreateBooking = fromArk(type({ hotel: 'string', stays: Stay.array() }));

CreateBooking.parse({ hotel: 'Lviv', stays: [{ guests: 4, capacity: 3 }] });
// { ok: false, issues: [{ message: 'must not exceed the capacity', path: ['stays', 0, 'guests'] }] }

constrainArk(type('string'), withinCapacity);
// throws TypeError: constrainArk: constraints attach to an ArkType object type
```

## See also

- [How to use nominal types with ArkType](../../guides/validators/arktype.md)
- [Schemas: `n.constraint()`](../schemas.md)
- [Benchmarks](../benchmarks.md)

[← Adapters](README.md) · [← Reference](../README.md)
