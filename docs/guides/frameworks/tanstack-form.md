# How to use nominal types with TanStack Form

TanStack Form takes a [Standard Schema](../../reference/glossary.md) as a validator, and a nominal schema works there. Its types refuse one, though, so this page checks fields with a small function and turns the form into instances on submit.

## Before you start

- Install the package and TanStack Form for React:

  ```sh
  npm install @horizon-republic/nominal-types @tanstack/react-form
  ```

- This page uses `@tanstack/react-form` 1.

## Quick example

`messageOf()` gives the first message of a value the schema refuses. Each field calls it, and `onSubmit` builds the instances with `parse()`:

```tsx
// order-form.tsx
import { useForm } from '@tanstack/react-form';
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
import type { StandardSchemaV1, ValueOf } from '@horizon-republic/nominal-types';

const OrderForm = n.object({ customer: Email, quantity: n.of(PositiveInteger).fromString() });

type Order = ValueOf<typeof OrderForm>;

const messageOf = (schema: StandardSchemaV1, value: unknown): string | undefined => {
  const result = schema['~standard'].validate(value);

  return result instanceof Promise ? undefined : result.issues?.[0]?.message;
};

export function OrderFormView({ onOrder }: { onOrder: (order: Order) => void }) {
  const form = useForm({
    defaultValues: { customer: '', quantity: '1' },
    onSubmit: ({ value }) => {
      const order = OrderForm.parse(value);

      if (order.ok) {
        onOrder(order.value); // order.value.customer is an Email
      }
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="customer" validators={{ onChange: ({ value }) => messageOf(Email, value) }}>
        {(field) => (
          <>
            <input value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
            <p role="alert">{field.state.meta.errors.join(', ')}</p>
          </>
        )}
      </form.Field>
      <form.Field
        name="quantity"
        validators={{ onChange: ({ value }) => messageOf(n.of(PositiveInteger).fromString(), value) }}
      >
        {(field) => (
          <>
            <input value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
            <p role="alert">{field.state.meta.errors.join(', ')}</p>
          </>
        )}
      </form.Field>
      <button type="submit">Order</button>
    </form>
  );
}
```

What happens:

| Typed in                | Shown                                                                                           | `onOrder` gets                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `jane`, `0`             | `must be an email address (was a string of 4 characters)`, `must be a positive integer (was 0)` | nothing: the form can't be sent                  |
| `jane@example.com`, `3` | nothing                                                                                         | `{ customer: Email, quantity: PositiveInteger }` |

## Errors

The validator returns a string, so `field.state.meta.errors` is a list of messages. Each is the type's own message. A [sensitive type](../../reference/glossary.md), such as a password type, leaves the typed value out of it.

## Limits

- `validators: { onChange: OrderForm }` and a schema as a field validator check values at runtime. But TypeScript refuses them: TanStack Form wants the schema's input type to equal the form's values, and a nominal schema also takes instances, as in `string | Email`. Use a function, as in `messageOf()`.
- TanStack Form hands `onSubmit` the values as typed, not what the schema gives. With a schema as the form validator, `value.quantity` is still `"3"`. Call `parse()` in `onSubmit` to get instances.

## See also

- [How to use nominal types with React Hook Form](react-hook-form.md), whose resolver hands over instances.
- [How to read numbers and booleans from text](../core/read-text-values.md)
- [How to check untrusted input](../core/check-input.md)

[← Guides](../README.md)
