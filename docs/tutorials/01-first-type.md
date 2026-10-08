# Your first type

Lesson 1 of 7 in "Build a sign-up check".

In this lesson we set up a project and make a type for usernames.

At the end, `node main.ts` prints:

```text
jane_doe
Username { value: 'jane_doe' }
Hello, jane_doe!
```

## Before we start

We need Node.js 22.18 or later. It runs TypeScript files directly, so there is no build step. Check the version:

```shell
node --version
```

It prints `v22.18.0` or a higher number. Some versions also print an `ExperimentalWarning` about type stripping. Ignore it.

Make an empty folder and go into it:

```shell
mkdir sign-up && cd sign-up
```

Create a `package.json` and tell Node.js that our files use `import`:

```shell
npm init -y
npm pkg set type=module
```

Install the package, TypeScript and the type definitions of Node.js:

```shell
npm install @horizon-republic/nominal-types typescript @types/node
```

Create `tsconfig.json` with this content:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "strict": true,
    "noEmit": true,
    "erasableSyntaxOnly": true,
    "types": ["node"]
  }
}
```

## Step 1: Declare the type

Create `main.ts` with this content:

```ts
// main.ts
import { AnyString } from '@horizon-republic/nominal-types';

class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {}

const username = new Username('jane_doe');

console.log(username.value);
console.log(username);
```

Here is what each part does:

- `AnyString` is a built-in type that accepts any string.
- `.subtype('shop.Username', …)` makes a narrower type under it. `shop.Username` is the type name. It shows up in error messages.
- `/^[a-z0-9_]{3,20}$/u` is the rule: 3 to 20 lowercase letters, digits or underscores.
- `new Username('jane_doe')` checks the text and gives us an instance. The instance keeps the text in `value`.

Run it:

```shell
node main.ts
```

The output is:

```text
jane_doe
Username { value: 'jane_doe' }
```

Notice that `username` is an object, not a string. Its `value` holds the string.

## Step 2: Try a bad username

Add this line at the end of `main.ts`:

```ts
new Username('Jane Doe');
```

Run `node main.ts` again. Node.js stops and prints a long error. Find the line that starts with `NominalError`:

```text
NominalError: shop.Username: must be matched by ^[a-z0-9_]{3,20}$ (was "Jane Doe")
```

There is no way to get a `Username` that holds a bad value.

Delete the line before we go on.

## Step 3: Use the type in a function

Add a function that takes a `Username`, and call it. Put these lines at the end of `main.ts`:

```ts
const greet = (name: Username): string => `Hello, ${name.value}!`;

console.log(greet(username));
```

Run `node main.ts`. The output is:

```text
jane_doe
Username { value: 'jane_doe' }
Hello, jane_doe!
```

## Step 4: Let the compiler catch a plain string

Add a call with a plain string at the end of `main.ts`:

```ts
console.log(greet('Jane Doe'));
```

Run `node main.ts`. Node.js runs it without complaint, and the last line is wrong:

```text
Hello, undefined!
```

Node.js does not check types. The compiler, `tsc`, does. Run it:

```shell
npx tsc --noEmit
```

The output is:

```text
main.ts:13:19 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'Username'.

13 console.log(greet('Jane Doe'));
                     ~~~~~~~~~~


Found 1 error in main.ts:13
```

A plain string is not a `Username`, even when it looks like one. Delete the line, then run `npx tsc --noEmit` again. It prints nothing: there are no errors.

A type that the compiler tells apart by its name is a [nominal type](../reference/glossary.md). [What a nominal type is](../explanation/nominal-types.md) explains why this helps.

## What we built

`Username` holds only valid usernames, and the compiler keeps it apart from plain strings.

Here is `main.ts` so far:

```ts
// main.ts
import { AnyString } from '@horizon-republic/nominal-types';

class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {}

const username = new Username('jane_doe');

console.log(username.value);
console.log(username);

const greet = (name: Username): string => `Hello, ${name.value}!`;

console.log(greet(username));
```

## Next steps

Next lesson: [Use a built-in type](02-built-in-types.md). We add an email address to the project.

[← Tutorials](README.md)
