# How to make a stricter type or a variant

This guide shows how to make a new type from one you already have.

## Pick a tool

| You need                               | Use                 | Example                   |
| -------------------------------------- | ------------------- | ------------------------- |
| a stricter rule                        | `subtype()`         | `StaffEmail` from `Email` |
| a second name with the same rule       | `subtype()`         | `OrderId` from `Uuid`     |
| more methods on the same type          | `class … extends …` | `LinkedSku` from `Sku`    |
| a different rule with the same methods | `variant()`         | `LegacySku` from `Sku`    |

If you're not sure, use `subtype()`. [Type hierarchy](../../explanation/type-hierarchy.md) explains how the three differ.

## Make a stricter type

Call `subtype()` on the type with a name and a rule:

```ts
import { Email } from '@horizon-republic/nominal-types';

export class StaffEmail extends Email.subtype('shop.StaffEmail', /@shop\.example$/u) {}

const staff = new StaffEmail('jane@shop.example');

staff instanceof Email; // true
staff.domain; // 'shop.example', the getter comes from Email
StaffEmail.parse('jane@gmail.com'); // { ok: false, issues: [{ message: 'must be matched by @shop\.example$ (was a string of 14 characters)' }] }
StaffEmail.parse('nope'); // { ok: false, issues: [{ message: 'must be an email address (was a string of 4 characters)' }] }
```

The rules of `Email` run first. Your rule only sees values that passed them. Put cheap checks in the parent and expensive ones, such as a checksum, in the subtype.

A subtype fits where its parent is expected. The parent doesn't fit where the subtype is expected:

```ts
import { Email } from '@horizon-republic/nominal-types';

export class StaffEmail extends Email.subtype('shop.StaffEmail', /@shop\.example$/u) {}

const invite = (email: Email): string => `invited ${email.value}`;
const grantAdmin = (email: StaffEmail): string => `admin ${email.value}`;

invite(new StaffEmail('jane@shop.example')); // 'invited jane@shop.example'
grantAdmin(new Email('jane@gmail.com')); // ❌ compile error: Argument of type 'Email' is not assignable to parameter of type 'StaffEmail'.
```

## Add a limit to a built-in type

Built-in types have no options such as a maximum. Make a subtype with that limit:

```ts
import { PositiveInteger, satisfying } from '@horizon-republic/nominal-types';

const isAtMost99 = (value: unknown): value is number => typeof value === 'number' && value <= 99;

export class Quantity extends PositiveInteger.subtype(
  'shop.Quantity',
  satisfying(isAtMost99, 'at most 99', { maximum: 99 }),
) {}

new Quantity(3).value; // 3
Quantity.parse(0); // { ok: false, issues: [{ message: 'must be a positive integer (was 0)' }] }
Quantity.parse(120); // { ok: false, issues: [{ message: 'must be at most 99 (was 120)' }] }
```

## Give a type a second name

Call `subtype()` with a name only. The new type checks the same rules, and it keeps its values apart from the others:

```ts
import { Uuid } from '@horizon-republic/nominal-types';

export class OrderId extends Uuid.subtype('shop.OrderId') {}
export class CustomerId extends Uuid.subtype('shop.CustomerId') {}

const loadOrder = (id: OrderId): string => `order ${id.value}`;

loadOrder(new OrderId('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f')); // 'order 0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'
loadOrder(new CustomerId('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f')); // ❌ compile error: Argument of type 'CustomerId' is not assignable to parameter of type 'OrderId'.
```

## Add methods without a new type

Extend the class. The subclass is the same type as its parent, with more methods:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

export class LinkedSku extends Sku {
  get url(): string {
    return `https://shop.example/items/${this.value}`;
  }
}

new LinkedSku('ABC-1234').url; // 'https://shop.example/items/ABC-1234'
```

Don't give such a subclass a rule of its own with `static rule`. `new` on the subclass checks it, but any `Sku` still passes where the subclass is expected. Use `subtype()` for a rule that must hold.

## Accept other values with the same methods

`variant()` makes a type next to the original. It keeps the methods and replaces the original's rule. The rules above the original, here the string check of `AnyString`, still run:

```ts
import { AnyString, matching } from '@horizon-republic/nominal-types';

export class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {
  get category(): string {
    return this.value.slice(0, 3);
  }
}

export class LegacySku extends Sku.variant(
  'shop.LegacySku',
  matching(/^[A-Z]{3}\d{6}$/u, 'a legacy SKU such as ABC123456'),
) {}

const legacy = new LegacySku('ABC123456');

legacy.category; // 'ABC'
legacy instanceof Sku; // false
LegacySku.parse(42); // { ok: false, issues: [{ message: 'must be a string (was 42)' }] }
```

The methods were written for the original's values. Check that each one still fits, and override the ones that don't.

## Move a value to another type

Call `parse()` on the type you want. It checks the value against that type's rules:

```ts
import { Email } from '@horizon-republic/nominal-types';

export class StaffEmail extends Email.subtype('shop.StaffEmail', /@shop\.example$/u) {}

StaffEmail.parse(new Email('jane@shop.example')); // { ok: true, value: StaffEmail { value: 'jane@shop.example' } }
StaffEmail.parse(new Email('jane@gmail.com')); // { ok: false, issues: [{ message: 'must be matched by @shop\.example$ (was a string of 14 characters)' }] }
```

This works between types that share a type above them, such as `OrderId` and `CustomerId` under `Uuid`, and between a variant and its original. An instance of any other type is rejected: `must be a string (was object)`.

Don't cast with `as`. A cast compiles, but nothing checks the value.

## See also

- [Declaring types](../../reference/declaring.md): `subtype()` and `variant()`.
- [Type hierarchy](../../explanation/type-hierarchy.md)
- [How to declare a type](declare-a-type.md)

[← Guides](../README.md)
