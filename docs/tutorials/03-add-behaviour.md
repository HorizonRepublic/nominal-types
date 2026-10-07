# Add behaviour to a type

Lesson 3 of 7 in "Build a sign-up check".

In this lesson we give `Username` a getter. Then we make `StaffEmail`, a narrower type under `Email` for the addresses of our own staff.

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
/users/jane_doe
ana@shop.example.com
shop.example.com
Welcome mail sent to Jane.Doe+news@example.com
Welcome mail sent to ana@shop.example.com
Admin panel opened for ana@shop.example.com
```

## Before we start

We continue with the `main.ts` from [Use a built-in type](02-built-in-types.md).

## Step 1: Add a getter to Username

A type is a class, so it can have getters and methods. Replace the `Username` class in `main.ts` with this one:

```ts
class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {
  get profilePath(): string {
    return `/users/${this.value}`;
  }
}
```

Add this line at the end of `main.ts`:

```ts
console.log(username.profilePath);
```

Run `node main.ts`. The new line of output is:

```text
/users/jane_doe
```

A `Username` always holds a valid value, so the getter needs no checks.

## Step 2: Make a narrower email type

Staff addresses end with `@shop.example.com`. Add this class to `main.ts`, right below the `Username` class:

```ts
class StaffEmail extends Email.subtype('shop.StaffEmail', /@shop\.example\.com$/u) {}
```

A `StaffEmail` must pass both rules: the rule of `Email` and its own. It is a [subtype](../reference/glossary.md) of `Email`, so it has every getter and method of `Email`.

Add these lines at the end of `main.ts`:

```ts
const staffEmail = new StaffEmail('ana@shop.example.com');

console.log(staffEmail.value);
console.log(staffEmail.domain);
```

Run `node main.ts`. The new lines of output are:

```text
ana@shop.example.com
shop.example.com
```

## Step 3: Pass a staff email where an email is expected

Add a function that takes any `Email`, and call it with both addresses. Put these lines at the end of `main.ts`:

```ts
const welcome = (to: Email): string => `Welcome mail sent to ${to.value}`;

console.log(welcome(email));
console.log(welcome(staffEmail));
```

Run `node main.ts`. The new lines of output are:

```text
Welcome mail sent to Jane.Doe+news@example.com
Welcome mail sent to ana@shop.example.com
```

Notice that the compiler accepts `welcome(staffEmail)`. Every staff email is an email.

## Step 4: Keep other emails out of staff-only code

The other way round fails: not every email is a staff email. Add these lines at the end of `main.ts`:

```ts
const openAdminPanel = (who: StaffEmail): string => `Admin panel opened for ${who.value}`;

console.log(openAdminPanel(staffEmail));
console.log(openAdminPanel(email));
```

Run `npx tsc --noEmit`. The output is:

```text
main.ts:46:28 - error TS2345: Argument of type 'Email' is not assignable to parameter of type 'StaffEmail'.
  Types of property '[brand]' are incompatible.
    Type 'Readonly<Record<"nominal.AnyString", true>> & Readonly<Record<"nominal.Email", true>>' is not assignable to type 'Readonly<Record<"nominal.AnyString", true>> & Readonly<Record<"nominal.Email", true>> & Readonly<Record<"shop.StaffEmail", true>>'.
      Property '"shop.StaffEmail"' is missing in type 'Readonly<Record<"nominal.AnyString", true>> & Readonly<Record<"nominal.Email", true>>' but required in type 'Readonly<Record<"shop.StaffEmail", true>>'.

46 console.log(openAdminPanel(email));
                              ~~~~~


Found 1 error in main.ts:46
```

Delete the last line, `console.log(openAdminPanel(email));`. Run `npx tsc --noEmit` again. It prints nothing.

[Type hierarchy](../explanation/type-hierarchy.md) explains how types sit under one another.

## Step 5: Try a customer address as a staff email

Add this line at the end of `main.ts`:

```ts
new StaffEmail('jane.doe@example.com');
```

Run `node main.ts`. Find the line that starts with `NominalError`:

```text
NominalError: shop.StaffEmail: must be matched by @shop\.example\.com$ (was a string of 20 characters)
```

Notice that the message hides the address. `StaffEmail` is sensitive because `Email` is.

Delete the line before we go on.

## What we built

`Username` now has a `profilePath` getter. `StaffEmail` is a narrower `Email`: it works wherever an `Email` is expected, and only staff addresses get in.

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

console.log(username.profilePath);

const staffEmail = new StaffEmail('ana@shop.example.com');

console.log(staffEmail.value);
console.log(staffEmail.domain);

const welcome = (to: Email): string => `Welcome mail sent to ${to.value}`;

console.log(welcome(email));
console.log(welcome(staffEmail));

const openAdminPanel = (who: StaffEmail): string => `Admin panel opened for ${who.value}`;

console.log(openAdminPanel(staffEmail));
```

## Next steps

Next lesson: [Check input without exceptions](04-check-input.md). We check text from outside without stopping the program.

[← Tutorials](README.md)
