# n.configure()

The settings of the whole process: how messages read, whether they and logs show values, whether strings are trimmed, and whether checks use generated code. Terms are explained in the [glossary](glossary.md).

## Signature

```ts
n.configure(options?: Configuration): FullConfiguration
```

| Parameter | Type            | Description                                                           |
| --------- | --------------- | --------------------------------------------------------------------- |
| `options` | `Configuration` | Optional. The options to change. Options not named keep their values. |

Returns: every setting as it was before the call, as a frozen `FullConfiguration`. `n.configure(previous)` puts them all back. `n.configure()` changes nothing and returns the current settings.

Throws: `TypeError` for an option that doesn't exist or a value it doesn't take. Nothing changes then.

| Case                        | Message                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| no object                   | `n.configure(): pass an object of options`                                     |
| an unknown option           | `n.configure(): there is no option value`                                      |
| a value not offered         | `n.configure(): values must be "show", "length" or "hide"`                     |
| `messages` of another kind  | `n.configure(): messages must be a function, a map by issue code or undefined` |
| a map with an unknown code  | `n.configure(): there is no issue code missing`                                |
| a map entry of another kind | `n.configure(): messages.required must be a string or a function`              |
| `normalize` of another kind | `n.configure(): normalize must be an object, such as { trimStrings: true }`    |
| an unknown normalization    | `n.configure(): there is no option normalize.lowerCase`                        |

## Options

| Option                  | Type                                               | Default     | When it applies                 |
| ----------------------- | -------------------------------------------------- | ----------- | ------------------------------- |
| `messages`              | [`Messages`](#messages-messagemap-messagefunction) | `undefined` | from the next issue             |
| `values`                | `'show' \| 'length' \| 'hide'`                     | `'show'`    | from the next issue             |
| `inspect`               | `'show' \| 'hide'`                                 | `'show'`    | from the next `console.log()`   |
| `codes`                 | `boolean`                                          | `false`     | from the next issue             |
| `normalize.trimStrings` | `boolean`                                          | `false`     | from the next check             |
| `codegen`               | `'auto' \| 'off'`                                  | `'auto'`    | for checks built after the call |

An option given as `undefined` keeps its value, except `messages`: `messages: undefined` brings the English messages back.

### messages

Writes the messages of this package in place of the English ones. It takes one of two forms:

| Form                                                      | Example                            | What it does                                                                                                                                          |
| --------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| a map by [issue code](errors-and-messages.md#issue-codes) | `{ required: 'ist erforderlich' }` | Each code maps to a message, or to a function that gets an [`IssueDetails`](#issuedetails) and returns it. A code left out keeps the English message. |
| a function                                                | `(issue) => translate(issue)`      | Gets an [`IssueDetails`](#issuedetails) for every issue and returns the message.                                                                      |

A function that returns `undefined` keeps the English message. The map is copied when `n.configure()` is called, so changing it afterwards changes nothing.

It writes the messages of types, `n.object()`, `n.of()`, `n.union()`, `n.record()`, `n.tuple()`, `array()` and `n.constraint()`. Messages from a rule of another library, such as a Zod schema, are left as that library writes them.

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

An issue from a rule of another library has no code.

### normalize.trimStrings

`true` makes every type under `AnyString` trim its input before the check, as `String.prototype.trim()` does. The instance holds the trimmed text. A message names the value as it was given.

It also trims the text `fromString()` and `fromEnv()` read, for every type, before the text is read as a number, a boolean or a big integer.

A type declared with [`{ normalize: false }`](declaring.md#nominaloptions) and its subtypes are not trimmed, nor is the text read for them.

The JSON Schema of a type doesn't change. With trimming on, it is stricter than the type: its `pattern` refuses a value with spaces around it, which the type accepts.

### codegen

`'off'` builds every check without `new Function`, for a Content-Security-Policy without `'unsafe-eval'`. The package never tries code generation then, not even to test for it. The results are the same; the checks are slower.

The package builds no check while it loads, so a call in the first module your app imports comes in time. A check built before the call keeps how it was built.

## IssueDetails

```ts
interface IssueDetails {
  readonly code: IssueCode;
  readonly message: string;
  readonly description?: string;
  readonly value?: string;
  readonly typeName?: string;
  readonly path?: readonly PropertyKey[];
  readonly min?: number;
  readonly max?: number;
}
```

What a `messages` function gets for each issue.

| Field         | Description                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`        | The [issue code](errors-and-messages.md#issue-codes).                                                                                                                     |
| `message`     | The English message, with `values` and sensitive types applied.                                                                                                           |
| `description` | What the value must be, such as `'an email address'`. Missing for `required`, `not_allowed`, `constraint`, counts and repeats.                                            |
| `value`       | The value as the English message writes it, such as `'"nope"'`, `'42'` or `'a string of 4 characters'`. Missing with `values: 'hide'` and where a message names no value. |
| `typeName`    | The type whose own rule refused the value, such as `'nominal.Uuid'`.                                                                                                      |
| `path`        | Where the value sits in the input, such as `['address', 'city']`. Missing for an issue of the whole value.                                                                |
| `min`, `max`  | The fewest and the most items of an array, or keys of a record, for the `too_few_…` and `too_many_…` codes. `max` is missing when there is no limit.                      |

## Messages, MessageMap, MessageFunction

```ts
type MessageFunction = (issue: IssueDetails) => string | undefined;
type MessageMap = Readonly<Partial<Record<IssueCode, string | MessageFunction>>>;
type Messages = MessageFunction | MessageMap;
```

What the [`messages`](#messages) option takes.

## FullConfiguration

```ts
interface FullConfiguration {
  readonly messages: Messages | undefined;
  readonly values: "show" | "length" | "hide";
  readonly inspect: "show" | "hide";
  readonly normalize: { readonly trimStrings: boolean };
  readonly codes: boolean;
  readonly codegen: "auto" | "off";
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

See also: [How to configure messages, values and trimming](../guides/core/configure.md), [Errors and messages](errors-and-messages.md).

[← Reference](README.md)
