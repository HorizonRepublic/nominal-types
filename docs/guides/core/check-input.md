# How to check untrusted input

This guide shows how to check a value from outside your code, such as a form field or a message, without `try`/`catch`. For a whole request body, see [How to check a request body with objectOf()](check-an-object.md).

## Check a value with parse()

Call `parse()` on the type. It returns a result and never throws:

```ts
import { Email } from '@horizon-republic/nominal-types';

const input: unknown = 'jane';

const result = Email.parse(input);

if (result.ok) {
  console.log(`inviting someone at ${result.value.domain}`); // result.value is an Email
} else {
  console.log(result.issues); // [{ message: 'must be an email address (was a string of 4 characters)' }]
}
```

The result is one of two shapes:

| `ok`    | Other field | Holds                                           |
| ------- | ----------- | ----------------------------------------------- |
| `true`  | `value`     | the instance, such as an `Email`                |
| `false` | `issues`    | a list of `{ message, path? }`, one per problem |

`Email` is a sensitive type, so its messages hide the rejected value. See [How to keep values out of error messages](hide-values.md).

## Pick parse() or new

Use `parse()` for input from outside, where a bad value is expected.

Use `new` for values your own code makes, where a bad value is a bug. `new` throws a `NominalError`:

```ts
import { Email, NominalError } from '@horizon-republic/nominal-types';

try {
  new Email('jane');
} catch (error) {
  if (error instanceof NominalError) {
    error.message; // 'nominal.Email: must be an email address (was a string of 4 characters)'
    error.typeName; // 'nominal.Email'
    error.issues; // [{ message: 'must be an email address (was a string of 4 characters)' }]
  }
}
```

The message of a `NominalError` starts with the type name. The messages in `issues` don't.

## Pass an instance to parse()

`parse()` takes an instance of the type too. It returns the same object without checking it again:

```ts
import { Email } from '@horizon-republic/nominal-types';

const email = new Email('jane@example.com');
const result = Email.parse(email);

result.ok && result.value === email; // true
```

## Ask whether a value is an instance

Use `instanceof`:

```ts
import { Email } from '@horizon-republic/nominal-types';

const describe = (value: unknown): string => {
  if (value instanceof Email) {
    return `an email at ${value.domain}`; // value is an Email here
  }

  return 'something else';
};

describe(new Email('jane@example.com')); // 'an email at example.com'
describe('jane@example.com'); // 'something else'
```

`instanceof` and `parse()` also accept an instance made by another copy of the package, such as the CommonJS copy that a `require()` loads.

## See also

- [Type members](../../reference/type-members.md): `parse()`, `new` and what `parse()` does with instances.
- [Errors and messages](../../reference/errors-and-messages.md): `NominalError` and the issue shape.
- [Check input without exceptions](../../tutorials/04-check-input.md), the tutorial lesson.

[← Guides](../README.md)
