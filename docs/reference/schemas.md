# Schemas

The functions that build schemas from nominal types: lists, optional values, objects and rules across fields. Terms are explained in the [glossary](glossary.md).

| Entry                                | What it does                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| [`n`](#n)                            | The namespace that holds every function which builds a schema or a rule                 |
| [`n.of()`](#nof)                     | A type as a plain schema object, the start of a chain                                   |
| [`TypeSchema`](#typeschema)          | What `n.of()` returns: `parse()`, `array()`, `fromString()`, `optional()`, `nullable()` |
| [`ArrayOptions`](#arrayoptions)      | How many items `array()` accepts, and whether they may repeat                           |
| [`n.object()`](#nobject)             | A schema for an object whose fields are checked by their own schemas                    |
| [`ObjectSchema`](#objectschema)      | What `n.object()` returns: `strict()`, `fromEnv()`, `keys`                              |
| [`n.constraint()`](#nconstraint)     | A rule across fields of an object                                                       |
| [`Constraint`](#constraint-class)    | What `n.constraint()` returns                                                           |
| [`n.isObject()`](#nisobject)         | Tells an `n.object()` schema from other values                                          |
| [`n.isConstraint()`](#nisconstraint) | Tells a constraint from other values                                                    |

Every schema here is a [Standard Schema](glossary.md) and a [Standard JSON Schema](glossary.md). Each method returns a new schema and leaves the old one as it is.

## n

```ts
import { n } from '@horizon-republic/nominal-types';
```

The [namespace](glossary.md) `n` holds the functions that build schemas, rules and checks. You import it once and call its members:

| Member             | What it does                                    | Described in                                           |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------ |
| `n.of()`           | A type as a plain schema object                 | [`n.of()`](#nof)                                       |
| `n.object()`       | A schema for an object                          | [`n.object()`](#nobject)                               |
| `n.constraint()`   | A rule across fields of an object               | [`n.constraint()`](#nconstraint)                       |
| `n.matching()`     | A rule from a regular expression                | [`n.matching()`](declaring.md#nmatching)               |
| `n.satisfying()`   | A rule from a type guard                        | [`n.satisfying()`](declaring.md#nsatisfying)           |
| `n.oneOf()`        | A rule for a fixed set of values                | [`n.oneOf()`](declaring.md#noneof)                     |
| `n.hideValues()`   | Issues with the values left out of the messages | [`n.hideValues()`](errors-and-messages.md#nhidevalues) |
| `n.isType()`       | Tells a nominal type class from other values    | [`n.isType()`](declaring.md#nistype)                   |
| `n.isObject()`     | Tells an `n.object()` schema from other values  | [`n.isObject()`](#nisobject)                           |
| `n.isConstraint()` | Tells a constraint from other values            | [`n.isConstraint()`](#nisconstraint)                   |

`Nominal`, the built-in types, the classes such as `TypeSchema` and `ObjectSchema`, and every TypeScript type are imported by their own names.

## n.of()

```ts
n.of(Type): TypeSchema<Input, Instance>
```

| Parameter | Type                 | Description       |
| --------- | -------------------- | ----------------- |
| `Type`    | a nominal type class | The type to wrap. |

Returns: a [`TypeSchema`](#typeschema) that checks every rule of `Type` and gives an instance. It handles instances as [`Type.parse()`](type-members.md#parse) does.

Throws: a `TypeError` if `Type` is not a nominal type: `n.of() takes a nominal type (was "Uuid")`.

Some libraries treat any class as one of their own constructs. They take the plain object `n.of()` returns where they don't take the class.

Example:

```ts
import { n, Uuid } from '@horizon-republic/nominal-types';

const ids = n.of(Uuid).array({ min: 1, max: 100 });

ids.parse(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f']); // { ok: true, value: [Uuid] }
ids.parse(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', 'nope']); // { ok: false, issues: [{ message: 'must be a UUID (was "nope")', path: [1] }] }
```

See also: [How to accept lists, missing values and null](../guides/core/lists-and-optional-values.md), [How to use a type inside any Standard Schema library](../guides/validators/standard-schema.md).

## TypeSchema

The class `n.of()` returns. `ObjectSchema` extends it. Create it through `n.of()`, not with `new`.

| Member                                 | Returns                                                          |
| -------------------------------------- | ---------------------------------------------------------------- |
| [`parse(input)`](#parse)               | `{ ok: true, value }` or `{ ok: false, issues }`. Doesn't throw. |
| [`array(options?)`](#array)            | A schema for an array of values this schema accepts.             |
| [`fromString()`](#fromstring)          | The same schema, reading a number or boolean from text first.    |
| [`optional()`](#optional-and-nullable) | A schema that also accepts `undefined`.                          |
| [`nullable()`](#optional-and-nullable) | A schema that also accepts `null`.                               |
| `['~standard']`                        | The Standard Schema interface: `validate` and `jsonSchema`.      |

The methods apply from left to right:

| Chain                              | Accepts                                       |
| ---------------------------------- | --------------------------------------------- |
| `n.of(Uuid).array().optional()`    | an array of UUIDs, or `undefined`             |
| `n.of(Uuid).optional().array()`    | an array whose items are UUIDs or `undefined` |
| `n.of(Uuid).optional().nullable()` | a UUID, `undefined` or `null`                 |

### parse

```ts
schema.parse(input: unknown): Parsed<Output>
```

Returns: `{ ok: true, value }` or `{ ok: false, issues }`.

Throws: nothing for an invalid value.

Example:

```ts
import { Email, n } from '@horizon-republic/nominal-types';

const email = n.of(Email);
const result = email.parse('jane@example.com');

if (result.ok) {
  result.value.domain; // 'example.com'
}

email.parse('jane'); // { ok: false, issues: [{ message: 'must be an email address (was a string of 4 characters)' }] }
```

### array

```ts
schema.array(options?: ArrayOptions): TypeSchema<readonly Input[], readonly Output[]>
```

| Parameter | Type                            | Description                                                                                                                      |
| --------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `options` | [`ArrayOptions`](#arrayoptions) | Optional. How many items the array may hold, and whether they may repeat. Without it, any number, `0` included, repeats allowed. |

Returns: a schema for an array. Its value is a new array of what the item schema gives, read-only by type. A nominal type built on it freezes the array.

The count is checked before any item. Then every item is checked, and every issue carries the item's index at the start of its `path`. With `unique: true`, repeats are looked for last, once every item is valid.

Messages:

| Case              | Message                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| not an array      | `must be an array (was "0190f1c2-…")`                                       |
| wrong exact count | `must have 3 items (was 0)`                                                 |
| too few           | `must have at least 1 item (was 0)`                                         |
| too many          | `must have at most 1 item (was 2)`                                          |
| a bad item        | the item's message, with its index in `path`                                |
| a repeated item   | `must not repeat an item (was "a")`, with the index of the repeat in `path` |

Throws: a `TypeError` for invalid options. See [`ArrayOptions`](#arrayoptions).

Example:

```ts
import { n, Uuid } from '@horizon-republic/nominal-types';

const team = n.of(Uuid).array({ length: 3 });

team.parse([]); // { ok: false, issues: [{ message: 'must have 3 items (was 0)' }] }
n.of(Uuid).array({ length: 3, max: 5 }); // throws TypeError: array(): pass either length or min and max, not both
```

### fromString

```ts
schema.fromString(): TypeSchema<Input | string, Output>
```

The same schema, reading the value from text first. It is for values that arrive as strings: environment variables, query strings, form fields and CSV.

It reads a string through the type's [text form](glossary.md):

| Type is under | Text it reads                                           | Example                  |
| ------------- | ------------------------------------------------------- | ------------------------ |
| `AnyNumber`   | a number as JSON writes it                              | `'2'`, `'-1.5'`, `'1e3'` |
| `AnyBoolean`  | `'true'` and `'false'` only                             | `'true'`                 |
| `AnyString`   | the text as it is                                       | `'jane@example.com'`     |
| `AnyBigInt`   | the text as it is, since the type takes decimal strings | `'42'`                   |

Text it can't read goes to the rules unchanged. The rules then reject it with their usual message. For a number, that is `'two'`, `''`, `' 2'`, `'02'`, `'+2'`, `'0x10'` and `'NaN'`. For a boolean, it is `'TRUE'`, `'1'` and `'yes'`. A value that is not a string goes to the rules as it is.

Its JSON Schema describes the value, not the text. `n.of(PositiveInteger).fromString()` is described as a number.

Throws: a `TypeError` in two cases. The message is the same for both:

- called after `array()`, `optional()` or `nullable()`;
- called for a type with no text form, such as one made with `Nominal()`.

```
TypeError: fromString(): call it on n.of(Type) of a string, number, bigint or boolean type, before array(), optional() or nullable(); for an n.object() schema, call fromEnv()
```

Example:

```ts
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

const page = n.of(PositiveInteger).fromString();

page.parse('2'); // { ok: true, value: PositiveInteger }, value 2
page.parse('two'); // { ok: false, issues: [{ message: 'must be a number (was "two")' }] }
page.parse('0'); // { ok: false, issues: [{ message: 'must be a positive integer (was 0)' }] }
n.of(PositiveInteger).fromString().array(); // every item read from text
```

See also: [How to read numbers and booleans from strings](../guides/core/read-text-values.md).

### optional and nullable

```ts
schema.optional(): TypeSchema<Input | undefined, Output | undefined>
schema.nullable(): TypeSchema<Input | null, Output | null>
```

| Method       | Lets through | Any other value       |
| ------------ | ------------ | --------------------- |
| `optional()` | `undefined`  | checked by the schema |
| `nullable()` | `null`       | checked by the schema |

In [`n.object()`](#nobject), a field whose schema accepts `undefined` may be missing.

Example:

```ts
import { AnyString, n, Uuid } from '@horizon-republic/nominal-types';

const note = n.of(AnyString).optional();
const manager = n.of(Uuid).nullable();

note.parse(undefined); // { ok: true, value: undefined }
manager.parse(null); // { ok: true, value: null }
note.parse(null); // { ok: false, issues: [{ message: 'must be a string (was null)' }] }
```

## ArrayOptions

```ts
interface ArrayOptions {
  readonly length?: number;
  readonly min?: number;
  readonly max?: number;
  readonly unique?: boolean;
}
```

| Option   | Meaning                                        | Default  |
| -------- | ---------------------------------------------- | -------- |
| `length` | exactly this many items                        | none     |
| `min`    | at least this many items                       | `0`      |
| `max`    | at most this many items                        | no limit |
| `unique` | `true` refuses an item equal to an earlier one | `false`  |

With `unique: true`, two items are equal when [`equals()`](type-members.md#equals) says so. So two `Uuid` items that differ only in case are equal. Items without `equals()`, such as `null`, are equal when they are the same value. Objects from `n.object()` are equal when every field is equal.

Each repeat is reported with its own index. The first time a value appears is not reported. A [sensitive type](errors-and-messages.md#sensitive-types) leaves the value out of the message.

Example:

```ts
import { Email, n, Uuid } from '@horizon-republic/nominal-types';

const ids = n.of(Uuid).array({ unique: true });

ids.parse(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', '0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F']); // { ok: false, issues: [{ message: 'must not repeat an item (was "0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F")', path: [1] }] }
n.of(Email).array({ unique: true }).parse(['jane@example.com', 'jane@example.com']); // { ok: false, issues: [{ message: 'must not repeat an item (was a string of 16 characters)', path: [1] }] }
```

`array()` throws a `TypeError` for options it can't use:

| Case                                  | Message                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| not a whole number from 0 up          | `array(): min must be a whole number from 0 up (was -1)` |
| `length` together with `min` or `max` | `array(): pass either length or min and max, not both`   |
| `min` greater than `max`              | `array(): min (5) is greater than max (1)`               |
| `unique` that is not a boolean        | `array(): unique must be true or false (was yes)`        |

## n.object()

```ts
n.object(fields, ...constraints): ObjectSchema<ObjectInput<Fields>, ObjectValue<Fields>>
```

| Parameter     | Type                               | Description                                                       |
| ------------- | ---------------------------------- | ----------------------------------------------------------------- |
| `fields`      | `Record<string, field>`            | Maps each key to its schema.                                      |
| `constraints` | [`Constraint`](#constraint-class)s | Optional. Rules across fields that run once every field is valid. |

A field can be:

- a nominal type, such as `Email`;
- an `n.of()` schema, such as `n.of(AnyString).optional()`;
- another `n.object()` schema, for a nested object;
- any [Standard Schema](glossary.md) that answers synchronously.

Returns: an [`ObjectSchema`](#objectschema).

What it does with an input:

1. It refuses anything that isn't an object, arrays included: `must be an object (was "x")`.
2. It checks every field. It collects every issue, with the field's key at the start of its `path`.
3. A field whose schema accepts `undefined` may be missing. A missing one is left out of the result.
4. It drops keys it doesn't declare. With [`strict()`](#objectschema), each one is an issue instead.
5. It runs the constraints, once every field passed.
6. It returns a new object of the checked values, read-only by type. The input stays as it was.

The returned object is not frozen. A nominal type built on the schema freezes it.

Throws a `TypeError`:

| Case                                                  | Message                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| a field named `__proto__`                             | `n.object(): a field cannot be named __proto__`                            |
| a constraint lists a field the object doesn't declare | `n.object: a constraint reads capacity, which the object does not declare` |

The object drops undeclared keys before its constraints run. So such a constraint would reject every value.

Example:

```ts
import { AnyString, Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const CreateOrder = n.object({
  customer: Email,
  sku: Sku,
  quantity: PositiveInteger,
  note: n.of(AnyString).optional(),
});

CreateOrder.parse({ customer: 'jane@example.com', sku: 'ABC-1234', quantity: 2, coupon: 'X' });
// { ok: true, value: { customer: Email, sku: Sku, quantity: PositiveInteger } }
CreateOrder.parse({ customer: 'jane', sku: 'abc' });
// { ok: false, issues: [
//   { message: 'must be an email address (was a string of 4 characters)', path: ['customer'] },
//   { message: 'must be matched by ^[A-Z]{3}-\\d{4}$ (was "abc")', path: ['sku'] },
//   { message: 'must be a number (was undefined)', path: ['quantity'] },
// ] }
```

Given to [`Nominal()`](declaring.md#nominal), the schema makes a class with a getter per field and `copyWith()`. See [Members of a type built on n.object()](type-members.md#members-of-a-type-built-on-nobject).

See also: [How to check a request body with n.object()](../guides/core/check-an-object.md).

## ObjectSchema

The class `n.object()` returns. It extends [`TypeSchema`](#typeschema), so `parse()`, `array()`, `optional()`, `nullable()` and `['~standard']` work on it. It adds:

| Member      | Description                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `strict()`  | The same schema, refusing undeclared keys instead of dropping them. Each one gives the issue `is not allowed`, with the key as its `path`. |
| `fromEnv()` | The same schema, reading text for each field that is a nominal type with a [text form](glossary.md).                                       |
| `keys`      | The field names, in the order they were declared.                                                                                          |

`fromEnv()` is for `process.env` and other records of strings, such as query parameters:

- It reads a plain type field, such as `PORT: Port`, as `n.of(Port).fromString()` would.
- It keeps other fields as they are, such as `n.of(…)` and `n.object(…)` schemas. Give them `fromString()` yourself.
- It drops undeclared keys, so the whole `process.env` can be passed.
- It keeps the constraints and the `strict()` setting.

`fromString()` throws on an `ObjectSchema`. Use `fromEnv()` there.

Example:

```ts
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const Invite = n.object({ email: Email, seats: PositiveInteger });

Invite.keys; // ['email', 'seats']
Invite.strict().parse({ email: 'jane@example.com', seats: 2, admin: true });
// { ok: false, issues: [{ message: 'is not allowed', path: ['admin'] }] }
```

Example with `fromEnv()`:

```ts
import { AnyBoolean, n, Port, Url } from '@horizon-republic/nominal-types';

const Config = n.object({ PORT: Port, DEBUG: AnyBoolean, DATABASE_URL: Url }).fromEnv();

Config.parse({ PORT: '3000', DEBUG: 'false', DATABASE_URL: 'postgres://localhost/shop', HOME: '/root' });
// { ok: true, value: { PORT: Port, DEBUG: AnyBoolean, DATABASE_URL: Url } }
Config.parse({ PORT: 'abc', DEBUG: 'yes' });
// { ok: false, issues: [
//   { message: 'must be a number (was "abc")', path: ['PORT'] },
//   { message: 'must be a boolean (was "yes")', path: ['DEBUG'] },
//   { message: 'must be a URL (was undefined)', path: ['DATABASE_URL'] },
// ] }
```

See also: [How to read configuration from environment variables](../guides/core/read-config.md).

## n.constraint()

```ts
n.constraint(fields, check, options?): Constraint<Fields>
```

A rule across fields of an object, like a `CHECK` constraint over several columns in SQL.

| Parameter | Type                            | Description                                                                                                           |
| --------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `fields`  | `Record<string, field>`         | The fields the rule reads, each with its type: a nominal type, an `n.of()` schema or any synchronous Standard Schema. |
| `check`   | `(values) => boolean \| string` | Gets the checked values of the listed fields: instances for nominal types.                                            |
| `options` | `{ path?, message? }`           | Optional. `path` and `message`.                                                                                       |

What `check` returns:

| Return   | Result                                                   |
| -------- | -------------------------------------------------------- |
| `true`   | the fields agree                                         |
| `false`  | one issue, with `options.message` or the default message |
| a string | one issue, with that string as its message               |

Options:

| Option    | Type                              | Default                               | Description                                        |
| --------- | --------------------------------- | ------------------------------------- | -------------------------------------------------- |
| `path`    | a listed key, or an array of keys | none: the issue belongs to the object | The field the issue belongs to, or the path to it. |
| `message` | `string`                          | see the messages table                | The message when `check` returns `false`.          |

Returns: a [`Constraint`](#constraint-class).

What a constraint does with an object:

1. It refuses anything that isn't an object: `must be an object (was "x")`.
2. It checks each listed field against its type. A field that fails gives its own issue, with its key in `path`. Then `check` doesn't run.
3. It calls `check` with the checked values.
4. It returns a copy of the object with the checked values in place. Keys it doesn't list pass through unchecked.

Messages when `check` returns `false` and no `message` is set:

| `path`  | Message                                                    |
| ------- | ---------------------------------------------------------- |
| not set | `guests, capacity must agree`                              |
| set     | `must agree with capacity`, naming the other listed fields |

Throws: nothing when declared. A listed field whose schema answers asynchronously throws a `TypeError` when a value is checked.

Example:

```ts
import { n, Nominal, PositiveInteger } from '@horizon-republic/nominal-types';

const withinCapacity = n.constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

class Stay extends Nominal(
  'booking.Stay',
  n.object({ guests: PositiveInteger, capacity: PositiveInteger }, withinCapacity),
) {}

new Stay({ guests: 2, capacity: 4 }).guests.value; // 2
new Stay({ guests: 5, capacity: 4 }); // throws NominalError: booking.Stay: guests: must not exceed the capacity
new Stay({ guests: 0, capacity: 4 }); // throws NominalError: booking.Stay: guests: must be a positive integer (was 0)
```

The default messages, from a check that returns `false`:

```ts
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

const fields = { guests: PositiveInteger, capacity: PositiveInteger };
const fits = ({ guests, capacity }: { guests: PositiveInteger; capacity: PositiveInteger }): boolean =>
  guests <= capacity;

const input = { guests: 5, capacity: 4 };

n.constraint(fields, fits)['~standard'].validate(input);
// { issues: [{ message: 'guests, capacity must agree' }] }
n.constraint(fields, fits, { path: 'guests' })['~standard'].validate(input);
// { issues: [{ message: 'must agree with capacity', path: ['guests'] }] }
n.constraint(fields, fits, { message: 'too many guests' })['~standard'].validate(input);
// { issues: [{ message: 'too many guests' }] }
```

See also: [How to check one field against another](../guides/core/check-fields-together.md).

## Constraint class

The class `n.constraint()` returns. Create it through `n.constraint()`, not with `new`.

| Member          | Description                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `fields`        | The `fields` object given to `n.constraint()`.                                                                     |
| `['~standard']` | The Standard Schema interface. `validate` checks a whole object, as described in [`n.constraint()`](#nconstraint). |

A constraint can go to:

- `n.object(fields, constraint)`, as a rule of the object;
- `subtype()` of a type built on `n.object()`, as the subtype's rule;
- `Nominal(name, constraint)`, as a type's whole rule, see [`Nominal()`](declaring.md#nominal);
- an adapter's `constrain…()` function, see [Adapters](adapters/README.md).

Its JSON Schema is an object. The listed fields are in `properties`. The fields that can't be `undefined` are in `required`. `check` has no JSON Schema form.

## n.isObject()

```ts
n.isObject(value: unknown): value is ObjectSchema
```

Returns: `true` if `value` was made by `n.object()`, also by [another copy of the package](glossary.md). An `n.of()` schema gives `false`.

Throws: nothing.

```ts
import { Email, n } from '@horizon-republic/nominal-types';

n.isObject(n.object({ email: Email })); // true
n.isObject(n.of(Email)); // false
```

## n.isConstraint()

```ts
n.isConstraint(value: unknown): value is AnyConstraint
```

Returns: `true` if `value` was made by `n.constraint()`, also by [another copy of the package](glossary.md).

Throws: nothing.

```ts
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

n.isConstraint(n.constraint({ seats: PositiveInteger }, () => true)); // true
n.isConstraint(n.object({ email: Email })); // false
```

[← Reference](README.md)
