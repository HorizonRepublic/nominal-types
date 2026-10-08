# class-validator

Entry point: `@horizon-republic/nominal-types/adapters/class-validator`. Needs `class-validator` 0.14 or 0.15 and `class-transformer` 0.5.

| Export                | Kind      | Use it for                                          |
| --------------------- | --------- | --------------------------------------------------- |
| `NominalField()`      | decorator | a DTO property that holds a nominal type            |
| `NominalFieldOptions` | type      | the options of `NominalField()`                     |
| `NominalTarget`       | type      | a nominal type or an `n.of()` schema                |
| `TargetValue`         | type      | the value a target gives, such as `readonly Uuid[]` |

## NominalField()

```ts
function NominalField<Target extends NominalTarget>(
  target: Target,
  options?: NominalFieldOptions<TargetValue<Target>>,
): PropertyDecorator;
```

| Parameter | Type                            | Description                                                      |
| --------- | ------------------------------- | ---------------------------------------------------------------- |
| `target`  | nominal type or `n.of()` schema | what the property holds, such as `Email` or `n.of(Uuid).array()` |
| `options` | `NominalFieldOptions`           | optional; see [Options](#options)                                |

One decorator does three jobs:

- `plainToInstance` turns a valid value into an instance. NestJS's `ValidationPipe` does this with `transform: true`.
- Validation fails for a value the type rejects, with the type's message.
- The property counts as known, so `whitelist` keeps it.

A property is required unless its schema is `.optional()`. It needs no `@IsOptional()`.

Without `transform: true`, values are still validated, but the DTO holds plain values.

### Options

| Option                 | Type                                  | Default                    | Description                                                                                                                               |
| ---------------------- | ------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `serialize`            | `(value) => unknown`                  | the value                  | what `instanceToPlain` writes for the property. Gets the instance, or the list for an array schema. Not called for `undefined` or `null`. |
| `message`, `groups`, … | class-validator's `ValidationOptions` | class-validator's defaults | passed to class-validator as they are                                                                                                     |

`serialize` runs only through `instanceToPlain`, as NestJS's `ClassSerializerInterceptor` uses. `JSON.stringify` always writes the instance's value.

With `ClassSerializerInterceptor`, a nominal instance in a property without `@NominalField()` comes out as `{ "value": … }`.

### Errors

Each failure is a class-validator error with the constraint key `nominalField`. The message is `<property>: <type message>`. A list item adds its index, and a nested DTO adds the parent's name:

| Case          | Message                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| bad value     | `customer: must be an email address (was a string of 4 characters)`     |
| bad list item | `items.0: must be a UUID (was "nope")`                                  |
| missing value | `customer: must be a string (was undefined)`                            |
| nested DTO    | `billing.email: must be an email address (was a string of 1 character)` |

Throws `TypeError: NominalField() takes a nominal type or an n.of() schema` when `target` is neither.

## Example

Validate a DTO:

```ts
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Email, n, Uuid } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

class CreateOrderDto {
  @NominalField(Email)
  customer!: Email;

  @NominalField(n.of(Uuid).array({ min: 1, max: 50 }))
  items!: readonly Uuid[];

  @NominalField(n.of(Email).optional())
  backup?: Email;
}

const good = plainToInstance(CreateOrderDto, { customer: 'jane@example.com', items: ['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'] });
validateSync(good).length; // 0, and good.customer is an Email

const bad = plainToInstance(CreateOrderDto, { customer: 'jane', items: ['nope'] });
validateSync(bad).map((error) => error.constraints);
// [ { nominalField: 'customer: must be an email address (was a string of 4 characters)' },
//   { nominalField: 'items.0: must be a UUID (was "nope")' } ]
```

Choose what a property is written as:

```ts
import 'reflect-metadata';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { Email } from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';

class ContactDto {
  @NominalField(Email, { serialize: (email) => email.canonical().value })
  email!: Email;

  @NominalField(Email)
  backup!: Email;
}

const contact = plainToInstance(ContactDto, { email: 'Jane.Doe+news@Example.com', backup: 'Jane@Example.com' });
instanceToPlain(contact); // { email: 'jane.doe@example.com', backup: 'Jane@Example.com' }
```

## See also

- [How to use nominal types with class-validator](../../guides/validators/class-validator.md)
- [Schemas: `n.of()`](../schemas.md)
- [nest](nest.md)

[← Adapters](README.md) · [← Reference](../README.md)
