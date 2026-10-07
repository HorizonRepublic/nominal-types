# How to validate untrusted input

This guide shows how to check input that may be wrong, such as a request body or a form field, without `try`/`catch`.

## Using parse()

`new` throws when a value is bad. That is right for values your own code creates, where a bad value is a bug.

For input from outside, call `parse()`. It returns a result instead of throwing:

```ts
import { Email } from '@horizon-republic/nominal-types';

const result = Email.parse(input);

if (result.ok) {
  invite(result.value); // result.value is an Email
} else {
  reject(result.issues.map((issue) => issue.message)); // ['must be an email address (was "nope")']
}
```

Passing an existing `Email` to `Email.parse()` is fine. It returns the same object without checking it again.

## Using is()

To ask whether a value is already an `Email`, use `is()`. It checks the type and creates nothing:

```ts
if (Email.is(value)) {
  value.domain; // value is an Email here
}
```

[← Documentation](../README.md)
