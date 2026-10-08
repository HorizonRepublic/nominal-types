# How to configure messages, values and trimming

This guide shows how to set, for your whole app, how messages read, whether they show values, whether strings are trimmed, whether checks use generated code, and where warnings go.

## Configure once at startup

`n.configure()` changes the settings of the whole process. Call it in a module of its own:

```ts
// nominal.config.ts
import { n } from "@horizon-republic/nominal-types";

n.configure({ codes: true, values: "length" });
```

Import that module first in your entry point, before any module that checks values:

```ts
// main.ts
import "./nominal.config.ts";
import { startServer } from "./server.ts";

startServer();
```

What follows from it:

- Each call changes only the options it names. The others keep their values.
- A wrong option or value throws a `TypeError`, and nothing changes.
- The ES module and the CommonJS build of the package share the settings.

## Give each issue a code

A code is a fixed name for the kind of issue, such as `'required'`. Turn codes on with `codes: true`:

```ts
import { Email, n, PositiveInteger } from "@horizon-republic/nominal-types";

n.configure({ codes: true });

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

CreateOrder.parse({ customer: "jane" });
// { ok: false, issues: [
//   { code: 'pattern', message: 'must be an email address (was a string of 4 characters)', path: ['customer'] },
//   { code: 'required', message: 'is required', path: ['quantity'] },
// ] }
```

Codes don't change between versions; messages may. Every code is listed in [Issue codes](../../reference/errors-and-messages.md#issue-codes).

## Write messages in another language

Pass `messages` a map from [issue code](../../reference/errors-and-messages.md#issue-codes) to message. A code you leave out keeps the English message:

```ts
import { Email, n, PositiveInteger } from "@horizon-republic/nominal-types";

n.configure({
  messages: {
    required: "ist erforderlich",
    pattern: ({ description }) => `muss ${description} sein`,
  },
});

const SignUp = n.object({ email: Email, age: PositiveInteger });

SignUp.parse({ email: "jane" });
// { ok: false, issues: [
//   { message: 'muss an email address sein', path: ['email'] },
//   { message: 'ist erforderlich', path: ['age'] },
// ] }
```

A code maps to a fixed message or to a function. The function gets the details of the issue, listed below.

To write every message in one place, pass a function as `messages` instead. It gets the details of each issue and returns the new message. Return `undefined` to keep the English one.

This function writes some messages in Ukrainian:

```ts
import { Email, n, PositiveInteger } from "@horizon-republic/nominal-types";
import type { IssueDetails } from "@horizon-republic/nominal-types";

const descriptions: Readonly<Record<string, string>> = {
  "an email address": "адреса електронної пошти",
  "a positive integer": "додатне ціле число",
};

const ukrainian = ({
  code,
  description,
  value,
}: IssueDetails): string | undefined => {
  if (code === "required") {
    return "обов'язкове поле";
  }

  const expected =
    description === undefined ? undefined : descriptions[description];

  if (expected === undefined) {
    return undefined;
  }

  return value === undefined
    ? `має бути ${expected}`
    : `має бути ${expected} (було ${value})`;
};

n.configure({ messages: ukrainian });

const SignUp = n.object({ email: Email, age: PositiveInteger });

SignUp.parse({ email: "jane" });
// { ok: false, issues: [
//   { message: 'має бути адреса електронної пошти (було a string of 4 characters)', path: ['email'] },
//   { message: "обов'язкове поле", path: ['age'] },
// ] }
```

What the function gets:

| Field         | Example                         | Present for                            |
| ------------- | ------------------------------- | -------------------------------------- |
| `code`        | `'pattern'`                     | every issue                            |
| `message`     | `'must be a UUID (was "nope")'` | every issue: the English message       |
| `description` | `'a UUID'`                      | issues that say what the value must be |
| `value`       | `'"nope"'`                      | issues that show the value             |
| `typeName`    | `'nominal.Uuid'`                | issues from a type's own rule          |
| `path`        | `['address', 'city']`           | issues of a field or an item           |
| `min`, `max`  | `1`, `10`                       | item counts of an array                |

`value` is written as the English message writes it. A [sensitive type](hide-values.md) gives `a string of 4 characters`, never the value itself.

Messages from another library, such as a Zod rule inside a type, keep that library's wording.

## Hide values in every message

`values` sets how every message shows the rejected value:

| `values`           | Message                                          |
| ------------------ | ------------------------------------------------ |
| `'show'` (default) | `must be a UUID (was "secret-password-123")`     |
| `'length'`         | `must be a UUID (was a string of 19 characters)` |
| `'hide'`           | `must be a UUID`                                 |

With `'show'`, a sensitive type still hides its values. The count of items in an array message is always shown, since it is not the value.

This setting leaves every message without the value:

```ts
import { n, Uuid } from "@horizon-republic/nominal-types";

n.configure({ values: "hide" });

Uuid.parse("secret-password-123"); // { ok: false, issues: [{ message: 'must be a UUID' }] }
```

## Hide values in logs

`console.log()` shows the value of an instance, except for a sensitive type. With `inspect: 'hide'`, it hides the value of every instance:

```ts
import { n, Uuid } from "@horizon-republic/nominal-types";

n.configure({ inspect: "hide" });

console.log(new Uuid("0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"));
// Uuid { value: <hidden, a string of 36 characters> }
```

`toString()` and `toJSON()` still give the value.

## Trim strings before the check

By default, a string reaches the check exactly as it was sent. With `normalize: { trimStrings: true }`, every type under `AnyString` trims spaces and line breaks from both ends first. The instance holds the trimmed text:

```ts
import { Email, n, Uuid } from "@horizon-republic/nominal-types";

n.configure({ normalize: { trimStrings: true } });

Email.parse("  jane@example.com "); // { ok: true, value: Email } holding 'jane@example.com'
Uuid.parse(" nope "); // { ok: false, issues: [{ message: 'must be a UUID (was " nope ")' }] }
```

What follows from it:

- A message names the value as it was sent, spaces included.
- `fromString()` and `fromEnv()` trim the text before they read a number or a boolean: `' 8080 '` reads as `8080`.
- Types not under `AnyString`, such as `PositiveInteger` given a number, are not changed.
- The JSON Schema of a type stays as it is. It is stricter than the type: its `pattern` refuses `' jane@example.com'`.

Keep the input of one type exactly as sent with `{ normalize: false }`. Its subtypes keep it too:

```ts
import { AnyString, n } from "@horizon-republic/nominal-types";

n.configure({ normalize: { trimStrings: true } });

class Password extends AnyString.subtype("shop.Password", /^.{12,}$/u, {
  sensitive: true,
  normalize: false,
}) {}

new Password(" correct horse ").value; // ' correct horse '
```

## Turn off code generation

The package builds its checks with `new Function`. A page whose Content-Security-Policy has no `'unsafe-eval'` forbids that. The package then falls back to plain checks, but the browser may still report the first try.

`codegen: 'off'` makes the package never try:

```ts
// nominal.config.ts
import { n } from "@horizon-republic/nominal-types";

n.configure({ codegen: "off" });
```

Set it in the module your entry point imports first. Checks built before the call keep the code they were built with. The results are the same either way; only the speed differs.

## Send warnings to your logger

By default, the package writes its warnings with `console.warn`. Pass your app's logger as `logger` to get them in your logs instead.

A logger whose methods take the message first fits as it is, such as `console` or winston:

```ts
// nominal.config.ts
import { n } from "@horizon-republic/nominal-types";
import { logger } from "./logger.ts";

n.configure({ logger });
```

pino takes the fields first and the message second. Wrap it in `pinoLogger()`:

```ts
// nominal.config.ts
import pino from "pino";
import { n, pinoLogger } from "@horizon-republic/nominal-types";

n.configure({ logger: pinoLogger(pino({ level: "debug" })) });
```

In Fastify, pass `app.log`, which is a pino logger: `pinoLogger(app.log)`. In NestJS, use `nestLogger()` from the Nest adapter. See [How to use nominal types with NestJS](../frameworks/nestjs.md#errors).

What the logger gets:

- `warn`: a type name declared twice with different rules, and `new Function` blocked by the runtime.
- `debug`, if the logger has it: each value that `NominalPipe`, the Fastify adapter or a GraphQL scalar rejects, with the messages and paths of the issues. These messages hide values the same way the answers do.

`logger: false` turns every warning off. `logger: undefined` brings `console.warn` back. Every entry is listed in [n.configure()](../../reference/configure.md#logger).

## Put the settings back in tests

`n.configure()` returns every setting as it was before the call. Pass it back to undo the change:

```ts
import { n, Uuid } from "@horizon-republic/nominal-types";

const previous = n.configure({ values: "hide" });

Uuid.parse("nope"); // { ok: false, issues: [{ message: 'must be a UUID' }] }

n.configure(previous);

Uuid.parse("nope"); // { ok: false, issues: [{ message: 'must be a UUID (was "nope")' }] }
```

Test files that run in one process share the settings. Put them back after each test that changes them.

## See also

- [n.configure()](../../reference/configure.md): every option, its default and when it applies.
- [Errors and messages](../../reference/errors-and-messages.md): the issue codes and the message text.
- [How to keep values out of error messages](hide-values.md)

[← Guides](../README.md)
