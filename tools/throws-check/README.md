# throws-check

Checked exceptions for TypeScript, read from `@throws` tags.

Every function says in its doc comment what it can throw. The checker reads the bodies and
reports two things:

- a type that can leave a function without a `@throws` tag for it;
- a `@throws` tag for a type the function never throws.

A type can leave a function in two ways: a `throw` in its body, or a call to a function whose
`@throws` tags name it. So the tags work as a contract between a function and its callers,
much like `throws` clauses in Java or `@throws` checks in PHPStan.

```ts
import { ParseError } from './errors.ts';

/** @throws {@link ParseError} when the text is empty. */
export const parse = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty');
  }

  return text;
};

// Reported: load can throw ParseError from parse() without a @throws for it
export const load = (text: string): string => parse(text);
```

## Usage

The checker needs TypeScript 6 (`@typescript/typescript6`) and Node 22.18 or later.

From the command line:

```sh
throws-check --project tsconfig.json --include 'src/**/*.ts'
```

| Flag                        | Meaning                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `--project`, `-p`           | The tsconfig of the project. `tsconfig.json` by default.                                              |
| `--include`                 | A glob of the files to report on, relative to the tsconfig. Repeat it for more. All files by default. |
| `--report-unresolved`       | Also report what the checker cannot follow.                                                           |
| `--allow-unused-supertypes` | Count a wider tag as used when a narrower tag covers the same throw.                                  |

It prints one finding per line as `file:line:column message (code)` and exits with 1 when it
finds anything.

From code:

```ts
import { check } from 'throws-check';

const diagnostics = check({ project: 'tsconfig.json', include: ['src/**/*.ts'] });

for (const { file, line, column, code, message } of diagnostics) {
  console.log(`${file}:${line}:${column} ${message} (${code})`);
}
```

`check` returns the findings sorted by file and position. It throws an `Error` when it cannot
read the tsconfig.

## Options

| Option                  | Default   | Meaning                                                                                                                |
| ----------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `project`               | required  | Path to the tsconfig.                                                                                                  |
| `include`               | all files | Globs, relative to the folder of the tsconfig, of the files to report on. Other files still take part in the analysis. |
| `builtins`              | see below | Entries added to the table of standard functions. A key with an empty list removes the entry.                          |
| `syncCallbacks`         | see below | More functions known to call their function arguments before they return.                                              |
| `allowUnusedSupertypes` | `false`   | See [Unused tags](#unused-tags).                                                                                       |
| `reportUnresolved`      | `false`   | See [What the checker cannot follow](#what-the-checker-cannot-follow).                                                 |

## Writing the tags

A tag names its types in one of these forms:

| Form        | Example                                                     |
| ----------- | ----------------------------------------------------------- |
| JSDoc type  | `@throws {ParseError} when …`                               |
| JSDoc union | `@throws {ParseError \| NetworkError} when …`               |
| TSDoc link  | `@throws {@link ParseError} when …`                         |
| TSDoc links | `@throws {@link ParseError} \| {@link NetworkError} when …` |
| First word  | `@throws ParseError when …`                                 |

A function can carry several tags. The names resolve in the scope of the file first. A plain
name the file cannot see resolves to the one class or interface of that name the project
exports, so a doc comment can link a type the code itself does not import. A tag whose type does not resolve, or that names no type, is
reported as `malformed`.

## Rules

### Functions

Every function is checked on its own: declarations, arrow functions, function expressions,
methods, constructors, getters and setters. A function inside another function is a separate
body with its own tags.

Instance field initializers run in the constructor, so their throws count for the
constructor. A class without a constructor documents its implicit constructor in the doc
comment of the class; it also passes on what the parent constructor documents.

A function that another function returns throws when it is called, not when it is made, so
it documents itself: put the doc comment right in front of it, as in
`return /** @throws {@link ParseError} when … */ (text) => …`. The function that makes it
documents only what the making throws.

### Calls

A call passes on the `@throws` of the function it runs. The same goes for `new`, tagged
templates, `super(…)`, and reading or writing a property with a getter or a setter.

- An overloaded function passes on the tags of the overload the call picks. When that overload
  has none, the tags of the implementation count.
- A call through an interface or an abstract method passes on the tags of that member.
- Optional chaining (`a?.b()`) does not stop a throw.

### Standard functions

The standard library carries no `@throws` tags of its own, so the checker keeps a table:

| Call                                                                            | Throws                                   |
| ------------------------------------------------------------------------------- | ---------------------------------------- |
| `JSON.parse`                                                                    | `SyntaxError`                            |
| `BigInt()`                                                                      | `SyntaxError`, `RangeError`, `TypeError` |
| `new URL`                                                                       | `TypeError`                              |
| `RegExp()`, `new RegExp`, `Function()`, `new Function`                          | `SyntaxError`                            |
| `structuredClone`, `atob`, `btoa`                                               | `DOMException`                           |
| `decodeURI`, `decodeURIComponent`, `encodeURI`, `encodeURIComponent`            | `URIError`                               |
| `String.fromCodePoint`, `String.prototype.normalize`, `String.prototype.repeat` | `RangeError`                             |
| `Number.prototype.toFixed`, `toPrecision`, `toExponential`                      | `RangeError`                             |
| `BigInt.asIntN`, `BigInt.asUintN`                                               | `RangeError`                             |
| `new Intl.*`                                                                    | `RangeError`                             |
| `Temporal.*.from`, `Temporal.*.compare`, `new Temporal.*`                       | `RangeError`, `TypeError`                |

Where the type declarations of a library do carry `@throws` tags, such as `JSON.stringify` in
recent TypeScript versions, they count like any other.

Some calls throw only for some arguments, so the checker looks at the type of the first one,
with `as` casts removed:

| Call                                                       | Throws when the argument                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JSON.stringify`                                           | can hold a bigint, is `any`, `unknown`, `object` or `{}`, or has a `toJSON` of the project's own whose result can. Strings, numbers, booleans, `null`, `undefined`, functions, and arrays and objects made of them are safe. |
| `BigInt()`                                                 | is a string (`SyntaxError`), a number other than a safe integer literal (`RangeError`), `null`, `undefined` or a symbol (`TypeError`), or an object, `any` or `unknown` (all three). A bigint or a boolean is safe.          |
| `String.prototype.normalize`                               | is not one of the literals `'NFC'`, `'NFD'`, `'NFKC'` and `'NFKD'`.                                                                                                                                                          |
| `String.prototype.repeat`                                  | is not a literal whole number from 0 up.                                                                                                                                                                                     |
| `Number.prototype.toFixed`, `toExponential`, `toPrecision` | is not a literal whole number from 0 (1 for `toPrecision`) to 100.                                                                                                                                                           |

A key is a global path (`JSON.parse`), a constructor (`new URL`) or an instance method
(`String.prototype.normalize`). A `*` stands for one segment of the path. Change the table
with the `builtins` option:

```ts
check({
  project: 'tsconfig.json',
  builtins: { 'Math.sqrt': ['RangeError'], structuredClone: [] },
});
```

### try and catch

- A `catch` that does not rethrow swallows everything the `try` block throws.
- `throw e` with the caught value rethrows what reaches it.
- `if (e instanceof X) { … } else { throw e; }` and `if (!(e instanceof X)) throw e;` catch
  only `X`; the rest passes on.
- `if (e instanceof X) { …; return; } throw e;` catches only `X` too.
- `if (e instanceof X) throw e;` rethrows only `X`.
- `throw new Y('…', { cause: e })` throws `Y`, like any other `throw`.
- What a `finally` block throws always leaves the function.

### Async functions

What an async function throws becomes a rejection of its promise. The tags are the same:
`@throws` on an async function names what its promise rejects with.

- `await f()` passes on the rejections of `f`, and a `try` around it catches them.
- `return f()` passes them on in a function that returns a promise.
- A promise nobody awaits or returns passes nothing on.
- `new Promise((resolve, reject) => …)` rejects with what the executor throws and with what it
  passes to `reject`.
- `.then()` and `.finally()` pass on the rejections before them; `.catch()` stops them. What a
  handler throws passes on.

### Callbacks

A function passed as an argument passes its throws on only when the callee runs it before it
returns. The checker knows these callees:

`Array.from`, `Array.prototype.every`, `filter`, `find`, `findIndex`, `findLast`,
`findLastIndex`, `flatMap`, `forEach`, `map`, `reduce`, `reduceRight`, `some`, `sort`,
`toSorted`, `Map.prototype.forEach`, `Set.prototype.forEach`, `Map.groupBy`, `Object.groupBy`,
`String.prototype.replace`, `replaceAll`, `JSON.parse` (the reviver) and `JSON.stringify` (the
replacer).

Add library functions with the `syncCallbacks` option. For your own functions, name the
parameter in a `@rethrows` tag:

```ts
/**
 * Runs the callback inside a transaction.
 *
 * @rethrows callback
 */
export const transaction = <T>(callback: () => T): T => callback();
```

A function in either branch of `?:` counts as passed directly. An async callback or a generator
passes nothing on.

### Generators

A generator throws when its caller asks for the next value, not when it calls the generator
function. The checker charges the throws to the call of the generator function anyway, since
that is where iteration usually starts. Document them on the generator function with
`@throws`.

### Interfaces and parent classes

A method that implements an interface member or overrides a parent member may throw a subset of
what that member documents, never more. A member without tags allows nothing, unless it comes
from a declaration file without any `@throws` tags.

A method without its own `@throws` tags takes the tags of the member it implements.

### Unused tags

A tag is unused when nothing the function throws needs it. When two tags cover the same throw,
only the narrower one counts: `@throws {TypeError}` and `@throws {Error}` on a function that
throws only `TypeError` reports `Error` as unused. `allowUnusedSupertypes` counts both.

Classes compare by their declared parents, not by shape, so `RangeError` does not cover
`SyntaxError` even though both have the same members.

### Ignoring a statement

Put `// @throws-ignore <reason>` on the line before a statement. Nothing that statement throws
counts. The reason is required: an ignore without one is reported and does nothing.

```ts
export const defaults = (): Settings => {
  // @throws-ignore the text is a constant
  const parsed = JSON.parse('{"strict": true}') as Settings;

  return parsed;
};
```

The same comment in front of a function or a method skips that body, and in front of a class
without a constructor it skips the implicit constructor.

### Declaring a throw the checker cannot see

A call through `Reflect`, a value of type `Function` or a library without tags can throw what
the checker never learns about. Put `// @throws` with the type, in any form a tag takes, on the
line before the statement, and the statement counts as throwing it:

```ts
/** @throws {@link ParseError} when the class refuses the text. */
export const build = (make: new (text: string) => Model, text: string): Model => {
  // @throws {@link ParseError} the class checks the text in its constructor
  return Reflect.construct(make, [text]);
};
```

## Codes

| Code            | Meaning                                                                           |
| --------------- | --------------------------------------------------------------------------------- |
| `undocumented`  | A type can leave the function without a tag for it. Reported where it comes from. |
| `unused`        | A tag names a type the function never throws.                                     |
| `contract`      | A tag goes beyond what the implemented or overridden member allows.               |
| `malformed`     | A tag names no type, or a type not in scope.                                      |
| `ignore-reason` | A `@throws-ignore` comment has no reason.                                         |
| `unresolved`    | Something the checker cannot follow. Only with `reportUnresolved`.                |

## What the checker cannot follow

Some throws are invisible to it, and it says nothing about them unless `reportUnresolved` is on:

- a call whose callee is `any`;
- `throw` of a value typed `any` or `unknown`, other than the caught value of a `catch`;
- a callback passed to a callee it does not know to run it before returning.

## Limits

- Errors the runtime raises on its own, such as a `TypeError` from reading a property of
  `undefined`, are out of scope. So are stack overflows and out-of-memory errors.
- Code at the top level of a module and static class members are not checked.
- A function stored in a variable and called later carries no tags unless its declaration has
  them. Calls through destructured methods (`const { parse } = JSON`) lose their key in the
  table of standard functions.
- `Promise.all` and similar combinators pass no rejections on.
- Destructuring does not run getters as far as the checker knows.
- `JSON.stringify` does not see cycles: a type that refers to itself counts as safe.
- Only `instanceof` checks narrow a `catch`; a custom type guard narrows only the branch it
  guards.
- Names in tags resolve at the top level of the file, so a type declared inside a function
  cannot be named. A name the file cannot see and that two exported types share does not
  resolve.
