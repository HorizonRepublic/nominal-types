# What a nominal type is

Why wrap a value in a class, instead of checking it with Zod or marking it with a brand? This page compares the three ways to keep an email address apart from other strings.

## Two strings look the same to TypeScript

TypeScript compares types by their shape. Two values of type `string` have the same type, whatever they hold. So the compiler can't stop a swap:

```ts
const sendInvite = (to: string, team: string): void => {
  console.log(`inviting ${to} to team ${team}`);
};

const email = 'jane@example.com';
const teamId = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

sendInvite(teamId, email); // compiles and prints "inviting 0190f1c2-… to team jane@example.com"
```

A type alias such as `type Email = string` doesn't help: it is a second name for `string`.

## What "nominal" means

A nominal type is told apart by its name, not its shape. An `Email` and a `Uuid` both wrap a string, but the compiler refuses one where the other is expected.

TypeScript has no nominal types of its own. This package builds them from classes. Each class carries a hidden marker with its name, called a [brand](../reference/glossary.md), so two types don't mix.

## Why not a checked string from Zod

A validator such as Zod checks a value and gives back a `string`:

```ts
import { z } from 'zod';

const sendInvite = (to: string, team: string): void => {
  console.log(`inviting ${to} to team ${team}`);
};

const email = z.email().parse('jane@example.com'); // type: string
const teamId = z.uuid().parse('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'); // type: string

sendInvite(teamId, email); // still compiles
```

The type doesn't remember the check: the result is a plain `string`. The same holds for `z.string().email()`.

So every function that receives it must either check the value again or trust that someone did.

## Why not a branded string

A common trick is a branded string: a string type with a fake property that only the compiler sees:

```ts
type Email = string & { readonly __brand: 'Email' };

const sendInvite = (to: Email): void => {
  console.log(`inviting ${to}`);
};

sendInvite('jane@example.com'); // ❌ compile error: Argument of type 'string' is not assignable to parameter of type 'Email'.
sendInvite('not an address' as Email); // compiles: the cast makes one, and nothing checks it

const email = 'jane@example.com' as Email;
console.log(typeof email); // 'string'
```

The compiler keeps it apart from other strings, but:

- A cast (`as Email`) makes one from any string, and nothing checks the value.
- At runtime it is a plain string, so no code can tell a checked email from any other.
- It can't carry methods.

Zod's `.brand()` gives the same kind of branded string, with the same limits.

## Why classes

This package makes each type a class with a rule. The rule is a regular expression, a [type guard](../reference/glossary.md) or a schema from another library, such as Zod. `new` checks the value, and an instance exists only for a value that passed:

```ts
import { Email, Uuid } from '@horizon-republic/nominal-types';

const sendInvite = (to: Email, team: Uuid): void => {
  console.log(`inviting ${to.value} to team ${team.value}`);
};

const email = new Email('jane@example.com');
const team = new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');

sendInvite(email, team); // inviting jane@example.com to team 0190f1c2-…
sendInvite(team, email); // ❌ compile error: Type 'Uuid' is missing the following properties from type 'Email': local, domain, mailbox, tag, and 3 more.
email instanceof Email; // true
email.domain; // 'example.com'
new Email('not an address'); // throws NominalError: nominal.Email: must be an email address (was a string of 14 characters)
```

The three ways side by side:

| Question                                              | Checked string    | Branded string      | Class from this package                                 |
| ----------------------------------------------------- | ----------------- | ------------------- | ------------------------------------------------------- |
| Does the compiler keep types apart?                   | no                | yes                 | yes                                                     |
| Was every value checked?                              | only where called | no, a cast skips it | yes, `new` and `parse()` check                          |
| Can code tell it apart at runtime?                    | no                | no                  | yes, `email instanceof Email`                           |
| Can it have methods?                                  | no                | no                  | yes, `email.domain`                                     |
| What does it cost?                                    | nothing extra     | nothing extra       | one small object per value                              |
| Do `===`, `Set` and `Map` match equal values?         | yes               | yes                 | no, they compare objects: use `a.equals(b)` or `.value` |
| Does it stay itself through JSON, a cache or a queue? | yes, a string     | yes, a string       | no, it comes back as a plain value: `parse()` it again  |

[How to fix common problems](../guides/core/fix-common-problems.md#includes-set-and-map-dont-find-an-equal-value) shows each fix with code.

## Checked once

A value is checked when its instance is made, and never again. Code that receives an `Email` needs no checks of its own. `Email.parse()` hands an existing `Email` back unchecked.

Methods on the class, such as `email.domain`, run only on valid values. They show up in autocompletion, where a helper like `domainOf(text: string)` would have to be found, and would accept any string.

A subtype carries its parent's brand and its own. So it fits where its parent is expected, and not the other way round. [Type hierarchy](type-hierarchy.md) explains the ways to build one type on another.

`instanceof` works for instances made by another copy of the package, such as one loaded through `require` while your code uses `import`.

Every type is also a [Standard Schema](../reference/glossary.md). Libraries that accept one, such as NestJS 12, take the class as it is.

## See also

- [Tutorial: your first type](../tutorials/01-first-type.md)
- [Where checks belong](where-checks-belong.md)
- [Type hierarchy](type-hierarchy.md)
- [Performance](performance.md)
- [Glossary](../reference/glossary.md)

[← Explanation](README.md)
