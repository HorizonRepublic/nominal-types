# Check input without exceptions

Lesson 4 of 7 in "Build a sign-up check".

In this lesson we check input from outside, such as a form field, with `parse()`. It returns a result instead of throwing.

At the end, `node main.ts` prints:

```text
{ ok: true, value: Username { value: 'jane_doe' } }
{
  ok: false,
  issues: [
    {
      message: 'must be matched by ^[a-z0-9_]{3,20}$ (was "Jane Doe")'
    }
  ]
}
valid, profile at /users/jane_doe
invalid: must be matched by ^[a-z0-9_]{3,20}$ (was "jd")
invalid: must be a string (was 42)
```

## Before we start

We continue with the `main.ts` from [Add behaviour to a type](03-add-behaviour.md).

In `main.ts`, delete everything below the `StaffEmail` class. It now looks like this:

```ts
// main.ts
import { AnyString, Email } from '@horizon-republic/nominal-types';

class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {
  get profilePath(): string {
    return `/users/${this.value}`;
  }
}

class StaffEmail extends Email.subtype('shop.StaffEmail', /@shop\.example\.com$/u) {}
```

Run `node main.ts`. It prints nothing.

## Step 1: Parse a good value

Add this line at the end of `main.ts`:

```ts
console.log(Username.parse('jane_doe'));
```

Run `node main.ts`. The output is:

```text
{ ok: true, value: Username { value: 'jane_doe' } }
```

`parse()` returns an object. `ok: true` means the value is valid. `value` holds the new `Username`.

## Step 2: Parse a bad value

Add this line at the end of `main.ts`:

```ts
console.log(Username.parse('Jane Doe'));
```

Run `node main.ts`. The new lines of output are:

```text
{
  ok: false,
  issues: [
    {
      message: 'must be matched by ^[a-z0-9_]{3,20}$ (was "Jane Doe")'
    }
  ]
}
```

Nothing is thrown. The result has `ok: false` and a list of [issues](../reference/glossary.md). An issue is one reason the value was rejected.

Notice that the message has no `shop.Username:` in front. An issue holds only the reason; a thrown error adds the type name.

## Step 3: Act on the result

Write a function that checks any input and describes the result. Add these lines at the end of `main.ts`:

```ts
const describeUsername = (input: unknown): string => {
  const result = Username.parse(input);

  if (result.ok) {
    return `valid, profile at ${result.value.profilePath}`;
  }

  return `invalid: ${result.issues[0].message}`;
};

console.log(describeUsername('jane_doe'));
console.log(describeUsername('jd'));
console.log(describeUsername(42));
```

The input has the type `unknown`, because outside data can be anything. Run `node main.ts`. The new lines of output are:

```text
valid, profile at /users/jane_doe
invalid: must be matched by ^[a-z0-9_]{3,20}$ (was "jd")
invalid: must be a string (was 42)
```

## Step 4: Let the compiler make us check

Let's read the value without checking `ok` first. Add this line at the end of `main.ts`:

```ts
console.log(Username.parse('jd').value);
```

Run `npx tsc --noEmit`. The output is:

```text
main.ts:27:34 - error TS2339: Property 'value' does not exist on type 'Parsed<Username>'.
  Property 'value' does not exist on type '{ readonly ok: false; readonly issues: readonly Issue[]; }'.

27 console.log(Username.parse('jd').value);
                                    ~~~~~


Found 1 error in main.ts:27
```

A failed result has no `value`. The compiler lets us read `value` only inside `if (result.ok)`.

Delete the line. Run `npx tsc --noEmit` again. It prints nothing.

Use `new` for values our own code makes, where a bad value is a bug. Use `parse()` for values from outside. [Where checks belong](../explanation/where-checks-belong.md) explains why we check input at the edge of the program.

## What we built

We check outside input without exceptions and read why it was rejected.

Here is `main.ts` so far:

```ts
// main.ts
import { AnyString, Email } from '@horizon-republic/nominal-types';

class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {
  get profilePath(): string {
    return `/users/${this.value}`;
  }
}

class StaffEmail extends Email.subtype('shop.StaffEmail', /@shop\.example\.com$/u) {}

console.log(Username.parse('jane_doe'));
console.log(Username.parse('Jane Doe'));

const describeUsername = (input: unknown): string => {
  const result = Username.parse(input);

  if (result.ok) {
    return `valid, profile at ${result.value.profilePath}`;
  }

  return `invalid: ${result.issues[0].message}`;
};

console.log(describeUsername('jane_doe'));
console.log(describeUsername('jd'));
console.log(describeUsername(42));
```

## Next steps

Next lesson: [Check a whole form](05-check-a-form.md). We check a username, an email and a password in one go.

[← Tutorials](README.md)
