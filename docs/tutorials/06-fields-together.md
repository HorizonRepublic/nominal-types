# Check fields against each other

Lesson 6 of 7 in "Build a sign-up check".

In this lesson the form asks for the password twice, and we add a rule that the two match.

At the end, `node main.ts` prints:

```text
[ 'repeatPassword' ] must match the password
[ 'username' ] must be matched by ^[a-z0-9_]{3,20}$ (was "Jane Doe")
```

## Before we start

We continue with the `main.ts` from [Check a whole form](05-check-a-form.md).

In `main.ts`, delete everything below the `checkSignUp` function. We keep the types, `SignUp` and `checkSignUp`.

## Step 1: Ask for the password twice

Add a `repeatPassword` field to `SignUp`:

```ts
const SignUp = objectOf({
  username: Username,
  email: Email,
  password: Password,
  repeatPassword: Password,
  newsletter: schemaOf(AnyBoolean).optional(),
});
```

Add a form at the end of `main.ts`. The repeated password has a typo, `batery`:

```ts
checkSignUp({
  username: 'jane_doe',
  email: 'jane@example.com',
  password: 'correct horse battery',
  repeatPassword: 'correct horse batery',
});
```

Run `node main.ts`. The output is:

```text
jane_doe signed up with jane@example.com
```

The form passes: each password is valid on its own, and nothing compares them yet.

## Step 2: Add a rule across fields

Change the import at the top of `main.ts` to add `constraint`:

```ts
import {
  AnyBoolean,
  AnyString,
  Email,
  constraint,
  objectOf,
  schemaOf,
} from '@horizon-republic/nominal-types';
```

A [constraint](../reference/glossary.md) is a rule across fields of an object. Add this one above `SignUp`:

```ts
const passwordsMatch = constraint(
  { password: Password, repeatPassword: Password },
  ({ password, repeatPassword }) => password.equals(repeatPassword),
  { path: 'repeatPassword', message: 'must match the password' },
);
```

`constraint()` takes three things:

1. The fields the rule reads, each with its type.
2. A check. It gets the fields as instances and returns `true` when they agree.
3. Options: the field the issue belongs to, and the message.

Run `node main.ts`. The output does not change yet, because the form does not use the rule:

```text
jane_doe signed up with jane@example.com
```

## Step 3: Give the rule to the form

Pass `passwordsMatch` to `objectOf()` after the fields. Replace `SignUp` with this:

```ts
const SignUp = objectOf(
  {
    username: Username,
    email: Email,
    password: Password,
    repeatPassword: Password,
    newsletter: schemaOf(AnyBoolean).optional(),
  },
  passwordsMatch,
);
```

Run `node main.ts`. The output is:

```text
[ 'repeatPassword' ] must match the password
```

The issue belongs to `repeatPassword`, so a page can show it under that input.

## Step 4: Break a field and the rule at once

Add a second form at the end of `main.ts`. The username is bad, and the passwords still don't match:

```ts
checkSignUp({
  username: 'Jane Doe',
  email: 'jane@example.com',
  password: 'correct horse battery',
  repeatPassword: 'correct horse batery',
});
```

Run `node main.ts`. The new line of output is:

```text
[ 'username' ] must be matched by ^[a-z0-9_]{3,20}$ (was "Jane Doe")
```

Notice that the password issue is missing. The form runs its constraints only when every field is valid.

## What we built

`SignUp` now checks each field and then checks that the two passwords match.

Here is `main.ts` so far:

```ts
// main.ts
import {
  AnyBoolean,
  AnyString,
  Email,
  constraint,
  objectOf,
  schemaOf,
} from '@horizon-republic/nominal-types';

class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {
  get profilePath(): string {
    return `/users/${this.value}`;
  }
}

class StaffEmail extends Email.subtype('shop.StaffEmail', /@shop\.example\.com$/u) {}

class Password extends AnyString.subtype('shop.Password', /^.{12,}$/u, { sensitive: true }) {}

const passwordsMatch = constraint(
  { password: Password, repeatPassword: Password },
  ({ password, repeatPassword }) => password.equals(repeatPassword),
  { path: 'repeatPassword', message: 'must match the password' },
);

const SignUp = objectOf(
  {
    username: Username,
    email: Email,
    password: Password,
    repeatPassword: Password,
    newsletter: schemaOf(AnyBoolean).optional(),
  },
  passwordsMatch,
);

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
  repeatPassword: 'correct horse batery',
});

checkSignUp({
  username: 'Jane Doe',
  email: 'jane@example.com',
  password: 'correct horse battery',
  repeatPassword: 'correct horse batery',
});
```

## Next steps

Next lesson: [Answer an HTTP request](07-serve-it.md). We put the form behind a small web server.

[← Tutorials](README.md)
