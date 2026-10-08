# How to use nominal types with React Hook Form

The Standard Schema resolver of React Hook Form checks a form with a nominal schema. Each field shows the type's message, and the submit handler gets instances, such as an `Email`.

## Before you start

- Install the package, React Hook Form and its resolvers:

  ```sh
  npm install @horizon-republic/nominal-types react-hook-form @hookform/resolvers
  ```

- This page uses React Hook Form 7 and `@hookform/resolvers` 5. The resolver comes from `@hookform/resolvers/standard-schema`.

## Quick example

Describe the form with [n.object()](../core/check-an-object.md). Inputs hold text, so a number field reads it with [fromString()](../core/read-text-values.md):

```tsx
// order-form.tsx
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useForm } from 'react-hook-form';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
import type { ValueOf } from '@horizon-republic/nominal-types';

const OrderForm = n.object({
  customer: Email,
  quantity: n.of(PositiveInteger).fromString(),
});

type Order = ValueOf<typeof OrderForm>;

export function OrderFormView({ onOrder }: { onOrder: (order: Order) => void }) {
  const { register, handleSubmit, formState } = useForm({
    resolver: standardSchemaResolver(OrderForm),
    defaultValues: { customer: '', quantity: '1' },
  });

  return (
    <form onSubmit={handleSubmit((order) => onOrder(order))}>
      <input {...register('customer')} />
      <p role="alert">{formState.errors.customer?.message}</p>
      <input {...register('quantity')} />
      <p role="alert">{formState.errors.quantity?.message}</p>
      <button type="submit">Order</button>
    </form>
  );
}
```

What happens on submit:

| Typed in                | Shown                                                                                           | `onOrder` gets                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `jane`, `0`             | `must be an email address (was a string of 4 characters)`, `must be a positive integer (was 0)` | nothing                                          |
| `jane@example.com`, `3` | nothing                                                                                         | `{ customer: Email, quantity: PositiveInteger }` |

## Check fields together

To check one field against another, such as a repeated password, add a constraint to the schema. See [How to check one field against another](../core/check-fields-together.md).

## Errors

Each issue becomes the error of the field in its path: `formState.errors.customer.message`. The message is the type's own message.

A [sensitive type](../../reference/glossary.md), such as a password type, leaves the typed value out of its message.

## Limits

- `handleSubmit` gets instances. To send them to a server as JSON, write them with [n.plain()](../../reference/schemas.md#nplain) or `JSON.stringify()`, which uses each instance's `toJSON()`.
- A field that reads text needs `n.of(Type).fromString()`. A plain `PositiveInteger` field gets `"3"` from the input and refuses it: `must be a number (was "3")`.

## See also

- [How to use nominal types with TanStack Form](tanstack-form.md)
- [How to check a request body with n.object()](../core/check-an-object.md)
- [How to read numbers and booleans from text](../core/read-text-values.md)

[← Guides](../README.md)
