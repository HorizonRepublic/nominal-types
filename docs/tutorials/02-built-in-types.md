# Use a built-in type

Lesson 2 of 7 in "Build a sign-up check".

In this lesson we add an email address with `Email`, a type that comes with the package.

At the end, `node main.ts` prints:

```text
jane_doe
Username { value: 'jane_doe' }
Hello, jane_doe!
Jane.Doe+news@example.com
example.com
jane.doe@example.com
false
true
```

## Before we start

We continue with the `main.ts` from [Your first type](01-first-type.md).

## Step 1: Make an email address

Change the first line of `main.ts` to import `Email` as well:

```ts
import { AnyString, Email } from '@horizon-republic/nominal-types';
```

Add these lines at the end of `main.ts`:

```ts
const email = new Email('Jane.Doe+news@example.com');

console.log(email.value);
console.log(email.domain);
```

Run `node main.ts`. The new lines of output are:

```text
Jane.Doe+news@example.com
example.com
```

`domain` returns everything after the `@`. [Built-in string types](../reference/types/string.md) lists every member of `Email`.

## Step 2: Try a bad address

Add this line at the end of `main.ts`:

```ts
new Email('jane');
```

Run `node main.ts`. Find the line that starts with `NominalError`:

```text
NominalError: nominal.Email: must be an email address (was a string of 4 characters)
```

Notice that the message does not show `jane`. An email address is personal data, so `Email` is a [sensitive type](../reference/glossary.md): its messages tell the kind and length of a bad value, never the value.

Delete the line before we go on.

## Step 3: Get the canonical form

`canonical()` returns the address in lowercase and without the `+news` tag. Add this line at the end of `main.ts`:

```ts
console.log(email.canonical().value);
```

Run `node main.ts`. The new line of output is:

```text
jane.doe@example.com
```

`canonical()` returns a new `Email`, so we read its `value`.

## Step 4: Compare two addresses

Add these lines at the end of `main.ts`:

```ts
const sameEmail = new Email('Jane.Doe+news@example.com');

console.log(email === sameEmail);
console.log(email.equals(sameEmail));
```

Run `node main.ts`. The new lines of output are:

```text
false
true
```

`===` asks whether both sides are the same object. `equals()` asks whether they hold the same value. Compare instances with `equals()`.

## Step 5: Let the compiler keep types apart

Pass an email where a username is expected. Add this line at the end of `main.ts`:

```ts
console.log(greet(email));
```

Run `npx tsc --noEmit`. The output is:

```text
main.ts:24:19 - error TS2345: Argument of type 'Email' is not assignable to parameter of type 'Username'.
  Types of property '[brand]' are incompatible.
    Type 'Readonly<Record<"nominal.AnyString", true>> & Readonly<Record<"nominal.Email", true>>' is not assignable to type 'Readonly<Record<"nominal.AnyString", true>> & Readonly<Record<"shop.Username", true>>'.
      Property '"shop.Username"' is missing in type 'Readonly<Record<"nominal.AnyString", true>> & Readonly<Record<"nominal.Email", true>>' but required in type 'Readonly<Record<"shop.Username", true>>'.

24 console.log(greet(email));
                     ~~~~~


Found 1 error in main.ts:24
```

The first line says what matters: an `Email` is not a `Username`.

Delete the line. Run `npx tsc --noEmit` again. It prints nothing.

## What we built

`Username` and `Email` don't mix. `Email` gives us its `domain` and its canonical form.

Here is `main.ts` so far:

```ts
// main.ts
import { AnyString, Email } from '@horizon-republic/nominal-types';

class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {}

const username = new Username('jane_doe');

console.log(username.value);
console.log(username);

const greet = (name: Username): string => `Hello, ${name.value}!`;

console.log(greet(username));

const email = new Email('Jane.Doe+news@example.com');

console.log(email.value);
console.log(email.domain);
console.log(email.canonical().value);

const sameEmail = new Email('Jane.Doe+news@example.com');

console.log(email === sameEmail);
console.log(email.equals(sameEmail));
```

## Next steps

Next lesson: [Add behaviour to a type](03-add-behaviour.md). We give `Username` a getter and make a narrower email type for staff.

[← Tutorials](README.md)
