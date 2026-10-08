# n.configure()

The settings of the whole process: how messages read, whether they and logs show values, whether strings are trimmed, whether checks use generated code, how many issues a check reports, and where warnings go. Terms are explained in the [glossary](glossary.md).

## Signature

```ts
n.configure(options?: Configuration): FullConfiguration
```

| Parameter | Type            | Description                                                           |
| --------- | --------------- | --------------------------------------------------------------------- |
| `options` | `Configuration` | Optional. The options to change. Options not named keep their values. |

Returns: every setting as it was before the call, as a frozen `FullConfiguration`. `n.configure(previous)` puts them all back. `n.configure()` changes nothing and returns the current settings.

Throws: `TypeError` for an option that doesn't exist or a value it doesn't take. Nothing changes then.

| Case                        | Message                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| no object                   | `n.configure(): pass an object of options`                                                          |
| an unknown option           | `n.configure(): there is no option value`                                                           |
| a value not offered         | `n.configure(): values must be "show", "length" or "hide"`                                          |
| `messages` of another kind  | `n.configure(): messages must be a function, a map by issue code or undefined`                      |
| a map entry of another kind | `n.configure(): messages.required must be a string or a function`                                   |
| `normalize` of another kind | `n.configure(): normalize must be an object, such as { trimStrings: true }`                         |
| an unknown normalization    | `n.configure(): there is no option normalize.lowerCase`                                             |
| `logger` of another kind    | `n.configure(): logger must be an object with a warn method and an optional debug method, or false` |
| `maxIssues` of another kind | `n.configure(): maxIssues must be a whole number from 1 up, or Infinity`                            |

## Options

| Option                  | Type                                               | Default     | When it applies                 |
| ----------------------- | -------------------------------------------------- | ----------- | ------------------------------- |
| `messages`              | [`Messages`](#messages-messagemap-messagefunction) | `undefined` | from the next issue             |
| `values`                | `'show' \| 'length' \| 'hide'`                     | `'show'`    | from the next issue             |
| `inspect`               | `'show' \| 'hide'`                                 | `'show'`    | from the next `console.log()`   |
| `codes`                 | `boolean`                                          | `false`     | from the next issue             |
| `normalize.trimStrings` | `boolean`                                          | `false`     | from the next check             |
| `codegen`               | `'auto' \| 'off'`                                  | `'auto'`    | for checks built after the call |
| `maxIssues`             | `number`                                           | `100`       | from the next check             |
| `logger`                | [`Logger`](#logger-interface) \| `false`           | `undefined` | from the next entry             |

An option given as `undefined` keeps its value, except `messages` and `logger`: `messages: undefined` brings the English messages back, and `logger: undefined` brings `console.warn` back.

### messages

Writes the messages of this package in place of the English ones. It takes one of two forms:

| Form                                                      | Example                            | What it does                                                                                                                                          |
| --------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| a map by [issue code](errors-and-messages.md#issue-codes) | `{ required: 'ist erforderlich' }` | Each code maps to a message, or to a function that gets an [`IssueDetails`](#issuedetails) and returns it. A code left out keeps the English message. |
| a function                                                | `(issue) => translate(issue)`      | Gets an [`IssueDetails`](#issuedetails) for every issue and returns the message.                                                                      |

A function that returns `undefined` keeps the English message. The map is copied when `n.configure()` is called, so changing it afterwards changes nothing.

The map also takes the codes your own [rules](schemas.md#nrule) give, such as `duplicate_sku`. A message set for such a code replaces the `message` the rule reported. The function gets the `params` the rule gave.

It writes the messages of types, `n.object()`, `n.of()`, `n.union()`, `n.record()`, `n.tuple()`, `array()`, `n.constraint()` and `n.rule()`. Messages from a rule of another library, such as a Zod schema, are left as that library writes them.

`n.hideValues()`, `fromEnv()` and the `hideValues` option of the adapters ask the function again, with the value hidden. A message it wrote never shows more than the English one would.

### values

How messages show the rejected value:

| Value      | Message                                          | Sensitive types                   |
| ---------- | ------------------------------------------------ | --------------------------------- |
| `'show'`   | `must be a UUID (was "secret-password-123")`     | `(was a string of 19 characters)` |
| `'length'` | `must be a UUID (was a string of 19 characters)` | the same                          |
| `'hide'`   | `must be a UUID`                                 | the same                          |

`'length'` writes each value by its kind, as a [sensitive type](errors-and-messages.md#sensitive-types) does. `'hide'` leaves out ` (was …)` entirely.

It also applies to a rule of another library whose message ends in `(was …)` or `received …`, as [`n.hideValues()`](errors-and-messages.md#nhidevalues) reads them. The count in an array message, such as `must have at most 10 items (was 12)`, is always shown.

### inspect

`'hide'` makes `console.log()` and `util.inspect()` show every instance as a sensitive type's: `Uuid { value: <hidden, a string of 36 characters> }`. `toString()`, `toJSON()` and `value` are not changed.

### codes

`true` gives every issue of this package a `code`, before its message: `{ code: 'required', message: 'is required', path: ['email'] }`. See [Issue codes](errors-and-messages.md#issue-codes).

An issue from a rule of another library has no code. A [rule](schemas.md#nrule) of your own that gives a code puts it on the issue without `codes: true`.

### normalize.trimStrings

`true` makes every type under `AnyString` trim its input before the check, as `String.prototype.trim()` does. The instance holds the trimmed text. A message names the value as it was given.

It also trims the text `fromString()` and `fromEnv()` read, for every type, before the text is read as a number, a boolean or a big integer.

A type declared with [`{ normalize: false }`](declaring.md#nominaloptions) and its subtypes are not trimmed, nor is the text read for them.

The JSON Schema of a type doesn't change. With trimming on, it is stricter than the type: its `pattern` refuses a value with spaces around it, which the type accepts.

### codegen

`'off'` builds every check without `new Function`, for a Content-Security-Policy without `'unsafe-eval'`. The package never tries code generation then, not even to test for it. The results are the same; the checks are slower.

The package builds no check while it loads, so a call in the first module your app imports comes in time. A check built before the call keeps how it was built.

### maxIssues

The most issues one check reports. Past it, the check stops and adds one more issue, with the code `too_many_issues`:

```ts
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

n.configure({ maxIssues: 2 });

n.of(PositiveInteger).array().parse([0, 0, 0]);
// { ok: false, issues: [
//   { message: 'must be a positive integer (was 0)', path: [0] },
//   { message: 'must be a positive integer (was 0)', path: [1] },
//   { message: 'stopped after 2 issues' },
// ] }
```

It takes a whole number from 1 up, or `Infinity` for every issue. The limit counts the issues of the whole value, nested lists and objects included. A check with exactly `maxIssues` issues reports them all.

It keeps a large bad input, such as a file of 10,000 rows, from building a response with tens of thousands of issues: an array stops checking its items once the limit is passed.

### logger

Where the package reports what it finds:

| Value                           | What happens                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `undefined`                     | Warnings go to `console.warn`, after `@horizon-republic/nominal-types: `. Nothing else is reported. |
| a [`Logger`](#logger-interface) | Warnings go to its `warn`. If it has a `debug` method, rejected values go there too.                |
| `false`                         | Nothing is reported.                                                                                |

What is reported:

| Method  | When                                                           | Message                                                                              | Details                                                                         |
| ------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `warn`  | a second type takes a name with different rules, once per name | `the type name "shop.Sku" is declared twice with different rules; …`                 | `{ typeName }`                                                                  |
| `warn`  | the runtime blocks `new Function`, once per process            | `new Function is blocked, so checks run slower; set n.configure({ codegen: 'off' })` | none                                                                            |
| `debug` | `NominalPipe` rejects a route argument                         | `NominalPipe rejected a route argument`                                              | `{ argument, name, issues }`                                                    |
| `debug` | the Fastify validator rejects a part of a request              | `fastifyNominal rejected a request`                                                  | `{ route, part, issues }`, such as `route: 'GET /orders/:id'`, `part: 'params'` |
| `debug` | a GraphQL scalar from `toGraphQL()` rejects a value            | `toGraphQL rejected a scalar value`                                                  | `{ scalar, issues }`                                                            |

Each item of `issues` holds the `message` and, when the issue has them, the `path` and the `code`. The messages are the ones the response carries: [`values`](#values), sensitive types and the `hideValues` option of the adapter apply, so a hidden value is never logged.

A database adapter that reads a stored value its type refuses throws, and logs nothing.

The logger is called as a method, `logger.warn(message, details)`, so a class instance keeps `this`.

## IssueDetails

```ts
interface IssueDetails {
  readonly code: AnyIssueCode;
  readonly message: string;
  readonly description?: string;
  readonly value?: string;
  readonly typeName?: string;
  readonly path?: readonly PropertyKey[];
  readonly min?: number;
  readonly max?: number;
  readonly params?: Readonly<Record<string, unknown>>;
}
```

What a `messages` function gets for each issue.

| Field         | Description                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`        | The [issue code](errors-and-messages.md#issue-codes), or the code a [rule](schemas.md#nrule) gave. `AnyIssueCode` is `IssueCode` or any other string.                                           |
| `message`     | The English message, with `values` and sensitive types applied.                                                                                                                                 |
| `description` | What the value must be, such as `'an email address'`. Missing for `required`, `not_allowed`, `constraint`, counts and repeats.                                                                  |
| `value`       | The value as the English message writes it, such as `'"nope"'`, `'42'` or `'a string of 4 characters'`. Missing with `values: 'hide'` and where a message names no value.                       |
| `typeName`    | The type whose own rule refused the value, such as `'nominal.Uuid'`.                                                                                                                            |
| `path`        | Where the value sits in the input, such as `['address', 'city']`. Missing for an issue of the whole value.                                                                                      |
| `min`, `max`  | The fewest and the most items of an array, or keys of a record, for the `too_few_…` and `too_many_…` codes. `max` is missing when there is no limit. For `too_many_issues`, `max` is the limit. |
| `params`      | What a [rule](schemas.md#nrule) gave with the issue, as it gave it. Missing for other issues. `values: 'hide'` doesn't change it.                                                               |

## Messages, MessageMap, MessageFunction

```ts
type MessageFunction = (issue: IssueDetails) => string | undefined;
type MessageMap = Readonly<Partial<Record<IssueCode, string | MessageFunction>>> &
  Readonly<Record<string, string | MessageFunction | undefined>>;
type Messages = MessageFunction | MessageMap;
```

What the [`messages`](#messages) option takes.

## Logger interface

```ts
interface Logger {
  readonly warn: (message: string, details?: Record<string, unknown>) => void;
  readonly debug?: (message: string, details?: Record<string, unknown>) => void;
}
```

What the [`logger`](#logger) option takes. `console` and winston fit as they are, as does any logger whose methods take the message first.

## pinoLogger()

```ts
pinoLogger(logger: ObjectFirstLogger): Logger
```

```ts
interface ObjectFirstLogger {
  readonly warn: (details: Record<string, unknown>, message: string) => void;
  readonly debug: (details: Record<string, unknown>, message: string) => void;
}
```

Wraps a pino or bunyan logger, which take the details first and the message second. The details become fields of the entry. pino is not a dependency: any object of this shape fits.

For Nest's `Logger`, use [`nestLogger()`](adapters/nest.md#nestlogger).

## FullConfiguration

```ts
interface FullConfiguration {
  readonly messages: Messages | undefined;
  readonly values: "show" | "length" | "hide";
  readonly inspect: "show" | "hide";
  readonly normalize: { readonly trimStrings: boolean };
  readonly codes: boolean;
  readonly codegen: "auto" | "off";
  readonly maxIssues: number;
  readonly logger: Logger | false | undefined;
}
```

Every setting, as `n.configure()` returns it. `Configuration`, the type of `options`, has the same fields, each optional.

## Copies of the package

The settings live on `globalThis`. [Another copy of the package](glossary.md), such as the CommonJS build loaded next to the ES module one, reads and changes the same settings.

Example:

```ts
import { n, Uuid } from "@horizon-republic/nominal-types";

const previous = n.configure({ values: "hide", codes: true });

Uuid.parse("nope"); // { ok: false, issues: [{ code: 'pattern', message: 'must be a UUID' }] }

n.configure(previous);
```

See also: [How to configure messages, values and trimming](../guides/core/configure.md), [How to send warnings to your logger](../guides/core/configure.md#send-warnings-to-your-logger), [Errors and messages](errors-and-messages.md).

[← Reference](README.md)
