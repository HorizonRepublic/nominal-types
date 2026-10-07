# How to validate untrusted input

This guide shows how to check input that may be wrong, such as a request body or a form field, without catching exceptions.

Keep `new` for values your own code produces, where a failure is a bug. For untrusted input, call `parse()`: it returns the instance or the issues and doesn't throw.

```ts
const result = Email.parse(input);

if (result.ok) {
  invite(result.value);
} else {
  reject(result.issues.map((issue) => issue.message));
}
```

To check whether a value you hold is already an instance, use `is()`, which builds nothing:

```ts
if (Email.is(value)) {
  value.domain;
}
```

Passing an instance to `parse()` is safe and cheap: `Email.parse(email)` returns the same object without validating it again.

[← Documentation](../README.md)
