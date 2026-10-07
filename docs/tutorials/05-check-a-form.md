# Check a whole form

Lesson 5 of 7 in "Build a sign-up check".

In this lesson we check a whole sign-up form in one call: a username, an email, a password and an optional newsletter flag.

At the end, `node main.ts` prints:

```text
jane_doe signed up with jane@example.com
[ 'username' ] must be matched by ^[a-z0-9_]{3,20}$ (was "Jane Doe")
[ 'email' ] must be an email address (was a string of 4 characters)
[ 'password' ] must be matched by ^.{12,}$ (was a string of 6 characters)
[ 'newsletter' ] must be a boolean (was "yes")
[ 'username', 'email', 'password' ]
```

## Before we start

We continue with the `main.ts` from [Check input without exceptions](04-check-input.md).

In `main.ts`, delete everything below the `StaffEmail` class. We keep the imports and the two classes.

## Step 1: Add a password type

A password must have at least 12 characters, and it must never show up in a log. Add this class below the `StaffEmail` class, with a line that tries it:

```ts
class Password extends AnyString.subtype('shop.Password', /^.{12,}$/u, { sensitive: true }) {}

console.log(Password.parse('secret'));
```

`{ sensitive: true }` makes `Password` a [sensitive type](../reference/glossary.md), like `Email`. Run `node main.ts`. The output is:

```text
{
  ok: false,
  issues: [
    {
      message: 'must be matched by ^.{12,}$ (was a string of 6 characters)'
    }
  ]
}
```

Notice that `secret` is not in the message. Only its length is.

## Step 2: Describe the form

Change the first line of `main.ts` to import three more names:

```ts
import { AnyBoolean, AnyString, Email, objectOf, schemaOf } from '@horizon-republic/nominal-types';
```

Delete the `console.log(Password.parse('secret'));` line. In its place, add the form and a function that checks it:

```ts
const SignUp = objectOf({
  username: Username,
  email: Email,
  password: Password,
  newsletter: schemaOf(AnyBoolean).optional(),
});

const checkSignUp = (body: unknown): void => {
  const result = SignUp.parse(body);

  if (result.ok) {
    console.log(`${result.value.username.value} signed up with ${result.value.email.value}`);

    return;
  }

  for (const issue of result.issues) {
    console.log(issue.path, issue.message);
  }
};
```

Here is what is new:

- `objectOf()` takes one type per field and returns an [object schema](../reference/glossary.md). Its `parse()` checks every field.
- `AnyBoolean` is the built-in type for `true` and `false`.
- `schemaOf(AnyBoolean).optional()` lets the `newsletter` field be missing.
- Each issue has a `path`: the list of keys that lead to the bad field.

## Step 3: Check a good form

Add this call at the end of `main.ts`. The form has no `newsletter` field:

```ts
checkSignUp({
  username: 'jane_doe',
  email: 'jane@example.com',
  password: 'correct horse battery',
});
```

Run `node main.ts`. The output is:

```text
jane_doe signed up with jane@example.com
```

`result.value.username` is a `Username` and `result.value.email` is an `Email`. The form passes without `newsletter`, because that field is optional.

## Step 4: Check a bad form

Add this call at the end of `main.ts`. Every field is wrong:

```ts
checkSignUp({
  username: 'Jane Doe',
  email: 'jane',
  password: 'secret',
  newsletter: 'yes',
});
```

Run `node main.ts`. The new lines of output are:

```text
[ 'username' ] must be matched by ^[a-z0-9_]{3,20}$ (was "Jane Doe")
[ 'email' ] must be an email address (was a string of 4 characters)
[ 'password' ] must be matched by ^.{12,}$ (was a string of 6 characters)
[ 'newsletter' ] must be a boolean (was "yes")
```

Notice two things:

- We get every issue at once, not only the first one.
- The path tells us which field each issue belongs to.

## Step 5: Send a field the form does not have

A user can send keys we never asked for. Add these lines at the end of `main.ts`:

```ts
const withExtraKey = SignUp.parse({
  username: 'jane_doe',
  email: 'jane@example.com',
  password: 'correct horse battery',
  isAdmin: true,
});

if (withExtraKey.ok) {
  console.log(Object.keys(withExtraKey.value));
}
```

Run `node main.ts`. The new line of output is:

```text
[ 'username', 'email', 'password' ]
```

Notice that `isAdmin` is gone. The result holds only the fields the form describes.

## What we built

`SignUp` returns instances for a good form and one issue per bad field for a bad one. The password never shows up in a message.

Here is `main.ts` so far:

```ts
// main.ts
import { AnyBoolean, AnyString, Email, objectOf, schemaOf } from '@horizon-republic/nominal-types';

class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {
  get profilePath(): string {
    return `/users/${this.value}`;
  }
}

class StaffEmail extends Email.subtype('shop.StaffEmail', /@shop\.example\.com$/u) {}

class Password extends AnyString.subtype('shop.Password', /^.{12,}$/u, { sensitive: true }) {}

const SignUp = objectOf({
  username: Username,
  email: Email,
  password: Password,
  newsletter: schemaOf(AnyBoolean).optional(),
});

const checkSignUp = (body: unknown): void => {
  const result = SignUp.parse(body);

  if (result.ok) {
    console.log(`${result.value.username.value} signed up with ${result.value.email.value}`);

    return;
  }

  for (const issue of result.issues) {
    console.log(issue.path, issue.message);
  }
};

checkSignUp({
  username: 'jane_doe',
  email: 'jane@example.com',
  password: 'correct horse battery',
});

checkSignUp({
  username: 'Jane Doe',
  email: 'jane',
  password: 'secret',
  newsletter: 'yes',
});

const withExtraKey = SignUp.parse({
  username: 'jane_doe',
  email: 'jane@example.com',
  password: 'correct horse battery',
  isAdmin: true,
});

if (withExtraKey.ok) {
  console.log(Object.keys(withExtraKey.value));
}
```

## Next steps

Next lesson: [Check fields against each other](06-fields-together.md). We make sure the user typed the same password twice.

[← Tutorials](README.md)
