# Validating untrusted input

`new` throws, which suits values your own code produces. For input that might be wrong, such as a request body, use `parse()`: it returns the instance or the issues and never throws.

```ts
const result = Email.parse(input);

if (result.ok) {
  invite(result.value);
} else {
  reject(result.issues.map((issue) => issue.message));
}
```

`is()` narrows a value you already hold without building anything:

```ts
if (Email.is(value)) {
  value.domain;
}
```

`Email.parse(email)` returns the same object without validating it again, so checking a value you already built costs almost nothing.

[← Documentation](../README.md)
