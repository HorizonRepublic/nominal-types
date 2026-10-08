# Schemas

The functions that build schemas from nominal types: lists, optional values, objects, records, tuples and rules across fields. Terms are explained in the [glossary](glossary.md).

| Entry                                | What it does                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| [`n`](#n)                            | The namespace that holds every function which builds a schema or a rule            |
| [`n.of()`](#nof)                     | A type as a plain schema object, the start of a chain                              |
| [`TypeSchema`](#typeschema)          | What `n.of()` returns: `parse()`, `accepts()`, `toPlain()`, `stringify()` and more |
| [`ArrayOptions`](#arrayoptions)      | How many items `array()` accepts, and whether they may repeat                      |
| [`n.object()`](#nobject)             | A schema for an object whose fields are checked by their own schemas               |
| [`ObjectSchema`](#objectschema)      | What `n.object()` returns: `strict()`, `partial()`, `pick()`, `extend()` and more  |
| [`n.union()`](#nunion)               | A schema for an object of one of several shapes, told apart by a field             |
| [`UnionSchema`](#unionschema)        | What `n.union()` returns: `key`, `tags`                                            |
| [`n.record()`](#nrecord)             | A schema for an object whose keys are not known in advance                         |
| [`RecordSchema`](#recordschema)      | What `n.record()` returns: `keys`, `min()`, `max()`, `partial()`                   |
| [`n.tuple()`](#ntuple)               | A schema for an array whose positions hold different types                         |
| [`TupleSchema`](#tupleschema)        | What `n.tuple()` returns                                                           |
| [`n.constraint()`](#nconstraint)     | A rule across fields of an object                                                  |
| [`Constraint`](#constraint-class)    | What `n.constraint()` returns                                                      |
| [`n.isObject()`](#nisobject)         | Tells an `n.object()` schema from other values                                     |
| [`n.isConstraint()`](#nisconstraint) | Tells a constraint from other values                                               |
| [`n.plain()`](#nplain)               | A copy of any value with its instances replaced by plain values, for a response    |

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
| `n.union()`        | A schema for an object of one of several shapes | [`n.union()`](#nunion)                                 |
| `n.record()`       | A schema for an object with any keys            | [`n.record()`](#nrecord)                               |
| `n.tuple()`        | A schema for an array of fixed positions        | [`n.tuple()`](#ntuple)                                 |
| `n.constraint()`   | A rule across fields of an object               | [`n.constraint()`](#nconstraint)                       |
| `n.matching()`     | A rule from a regular expression                | [`n.matching()`](declaring.md#nmatching)               |
| `n.satisfying()`   | A rule from a type guard                        | [`n.satisfying()`](declaring.md#nsatisfying)           |
| `n.oneOf()`        | A rule for a fixed set of values                | [`n.oneOf()`](declaring.md#noneof)                     |
| `n.hideValues()`   | Issues with the values left out of the messages | [`n.hideValues()`](errors-and-messages.md#nhidevalues) |
| `n.plain()`        | A copy of a value with plain values only        | [`n.plain()`](#nplain)                                 |
| `n.isType()`       | Tells a nominal type class from other values    | [`n.isType()`](declaring.md#nistype)                   |
| `n.isObject()`     | Tells an `n.object()` schema from other values  | [`n.isObject()`](#nisobject)                           |
| `n.isConstraint()` | Tells a constraint from other values            | [`n.isConstraint()`](#nisconstraint)                   |

`Nominal`, the built-in types, the classes such as `TypeSchema`, `ObjectSchema`, `UnionSchema`, `RecordSchema` and `TupleSchema`, and every TypeScript type are imported by their own names.

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
| [`parseAsync(input)`](#parseasync)     | A Promise of the value. Rejects if `input` is invalid.           |
| [`accepts(input)`](#accepts)           | `true` if `parse()` would accept `input`. Builds no value.       |
| [`toPlain(value)`](#toplain)           | A copy of a value the schema gave, with plain values only.       |
| [`stringify(value)`](#stringify)       | The JSON text of a value the schema gave.                        |
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

### parseAsync

```ts
schema.parseAsync(input: unknown): Promise<Output>
```

Returns: a Promise of what [`parse()`](#parse) gives as `value`. It rejects with a [`NominalError`](errors-and-messages.md#nominalerror) if `input` is invalid. The error's `typeName` is the function that built the schema: `'n.of()'`, `'n.object()'` or `'n.union()'`.

It is for libraries that wait for a parser and expect it to throw, such as tRPC. In your own code, use `parse()`.

Example:

```ts
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const Order = n.object({ customer: Email, quantity: PositiveInteger });

await Order.parseAsync({ customer: 'jane', quantity: 2 }); // rejects: NominalError: n.object(): customer: must be an email address (was a string of 4 characters)
```

### accepts

```ts
schema.accepts(input: unknown): boolean
```

Returns: `true` if [`parse()`](#parse) would accept `input`, `false` otherwise.

Throws: nothing for an invalid value.

It builds no value, no instances and no issues, and it stops at the first field or item that fails. So it is several times faster than `parse()`. As with [`Type.accepts()`](type-members.md#accepts), it doesn't run a constructor of your own, and it doesn't change the type of `input`.

An object with constraints and an array with `unique: true` build their values to compare them. For them, `accepts()` saves only the result object.

Example:

```ts
import { n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

const ids = n.of(Uuid).array({ max: 2 });

ids.accepts(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f']); // true
ids.accepts(['nope']); // false
n.object({ seats: PositiveInteger }).accepts({ seats: 0 }); // false
```

### toPlain

```ts
schema.toPlain(value: Output): Plain<Output>
```

| Parameter | Type                              | Description                          |
| --------- | --------------------------------- | ------------------------------------ |
| `value`   | what the schema's `parse()` gives | The value to turn into plain values. |

Returns: a new copy of `value`. Each instance in it is replaced by what its [`toJSON()`](type-members.md#tojson-and-tostring) returns. Arrays and objects are new and can be changed. `value` stays as it was.

Throws: nothing.

Use it when a framework writes the response for you. `JSON.stringify()` calls `toJSON()` on each instance, which is slow. On a copy from `toPlain()`, it runs at the speed of plain values. To write the text yourself, [`stringify()`](#stringify) is faster still. See [Benchmarks](benchmarks.md#writing-json).

What it does with each part:

| Part of the value                                       | Result                                   |
| ------------------------------------------------------- | ---------------------------------------- |
| an instance                                             | what its `toJSON()` returns              |
| a field the object doesn't declare                      | left out, as `parse()` leaves it out     |
| a missing optional field                                | left out                                 |
| the fields of an object                                 | in the order the schema declares them    |
| `undefined` or `null` from `optional()` or `nullable()` | kept                                     |
| a field from another library, such as a Zod schema      | converted as [`n.plain()`](#nplain) does |

Example:

```ts
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const Invite = n.object({ email: Email, seats: PositiveInteger });
const result = Invite.parse({ email: 'jane@example.com', seats: 2 });

if (result.ok) {
  Invite.toPlain(result.value); // { email: 'jane@example.com', seats: 2 }
  JSON.stringify(Invite.toPlain(result.value)); // '{"email":"jane@example.com","seats":2}'
}
```

### stringify

```ts
schema.stringify(value: Output): string
```

| Parameter | Type                              | Description                 |
| --------- | --------------------------------- | --------------------------- |
| `value`   | what the schema's `parse()` gives | The value to write as JSON. |

Returns: the JSON text of `value`. It is the text `JSON.stringify(n.plain(value))` gives, with the fields of an object in the order the schema declares them.

Throws: a `TypeError` if JSON has no text for `value`, such as `undefined` from `optional()`: `stringify(): JSON has no text for undefined`.

Use it to write a response body. It writes each instance's value straight to text. It calls no `toJSON()` and makes no plain copy, so it is faster than `JSON.stringify()` even on plain values. See [Benchmarks](benchmarks.md#writing-json).

What it does with each part:

| Part of the value                                           | Result                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| an instance the schema gave                                 | its value                                               |
| a field the object doesn't declare                          | left out, as `toPlain()` leaves it out                  |
| a missing optional field                                    | left out                                                |
| `NaN` or an infinity                                        | `null`, as `JSON.stringify()` writes it                 |
| an instance whose `value` you reassigned                    | its new value, escaped as `JSON.stringify()` escapes it |
| an instance from [another copy of the package](glossary.md) | written by `JSON.stringify()`                           |
| a plain value, or a field from another library              | written by `JSON.stringify()`                           |

The first call builds a writer for the schema. Where code generation is forbidden, it writes `JSON.stringify(schema.toPlain(value))` instead, with the same text.

Example:

```ts
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const Invite = n.object({ email: Email, seats: PositiveInteger });
const result = Invite.parse({ seats: 2, email: 'jane@example.com' });

if (result.ok) {
  Invite.stringify(result.value); // '{"email":"jane@example.com","seats":2}'
}
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
2. It checks every field. It collects every issue, with the field's key at the start of its `path`. It reads only the input's own keys, not keys from its prototype.
3. A field whose schema accepts `undefined` may be missing. A missing one is left out of the result. Any other field that is missing or `undefined` gets the issue `is required`.
4. It drops keys it doesn't declare. With [`strict()`](#objectschema), each one is an issue instead.
5. It runs the constraints, once every field passed.
6. It returns a new object of the checked values, in the order the fields were declared, read-only by type. The input stays as it was.

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
//   { message: 'is required', path: ['quantity'] },
// ] }
```

Given to [`Nominal()`](declaring.md#nominal), the schema makes a class with a getter per field and `copyWith()`. See [Members of a type built on n.object()](type-members.md#members-of-a-type-built-on-nobject).

See also: [How to check a request body with n.object()](../guides/core/check-an-object.md).

## ObjectSchema

The class `n.object()` returns. It extends [`TypeSchema`](#typeschema), so `parse()`, `array()`, `optional()`, `nullable()` and `['~standard']` work on it. It adds:

| Member              | Description                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `strict()`          | The same schema, refusing undeclared keys instead of dropping them. Each one gives the issue `is not allowed`, with the key as its `path`. |
| `fromEnv()`         | The same schema, reading text for each field that is a nominal type with a [text form](glossary.md).                                       |
| `partial(...keys)`  | The same schema with every field, or the fields named, allowed to be missing.                                                              |
| `required(...keys)` | The same schema with every field, or the fields named, required.                                                                           |
| `pick(...keys)`     | The same schema with only the fields named.                                                                                                |
| `omit(...keys)`     | The same schema without the fields named.                                                                                                  |
| `extend(fields)`    | The same schema with more fields. A field of the same name is replaced in place.                                                           |
| `keys`              | The field names, in the order they were declared.                                                                                          |

Each method returns a new schema. They keep `strict()`, `fromEnv()` and each other's changes, so they chain: `CreateOrder.omit('note').partial().strict()`.

| Method       | Fields                                                                                                            | Constraints                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `partial()`  | May be missing. A field that holds `undefined` counts as missing.                                                 | One that reads such a field runs only when all its fields are present. |
| `required()` | Must be present, also those whose schema accepts `undefined`. A field that holds `undefined` gives `is required`. | Kept.                                                                  |
| `pick()`     | Only the fields named, in declared order.                                                                         | Kept when every field it reads is kept, dropped otherwise.             |
| `omit()`     | All but the fields named.                                                                                         | Kept when every field it reads is kept, dropped otherwise.             |
| `extend()`   | The new fields at the end. After `fromEnv()`, they are read from text too.                                        | Kept.                                                                  |

The TypeScript types follow: `partial()` gives `Partial` of the value, `pick()` gives `Pick`, `omit()` gives `Omit`. The JSON Schema follows too: its `properties` and `required` list the fields the new schema has.

Throws a `TypeError`:

| Case                                      | Message                                         |
| ----------------------------------------- | ----------------------------------------------- |
| a name the object doesn't declare         | `pick(): the object has no field named coupon`  |
| `pick()` or `omit()` with no name         | `pick(): name at least one field`               |
| `extend()` with a field named `__proto__` | `n.object(): a field cannot be named __proto__` |

`fromEnv()` is for `process.env` and other records of strings, such as query parameters:

- It reads a plain type field, such as `PORT: Port`, as `n.of(Port).fromString()` would.
- It keeps other fields as they are, such as `n.of(…)` and `n.object(…)` schemas. Give them `fromString()` yourself.
- It drops undeclared keys, so the whole `process.env` can be passed.
- It keeps the constraints and the `strict()` setting.
- It leaves the values out of its messages, as a [sensitive type](errors-and-messages.md#sensitive-types) does, since configuration holds secrets. This covers every field, nested objects and the constraints.

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
//   { message: 'must be a number (was a string of 3 characters)', path: ['PORT'] },
//   { message: 'must be a boolean (was a string of 3 characters)', path: ['DEBUG'] },
//   { message: 'is required', path: ['DATABASE_URL'] },
// ] }
```

Example with `partial()`, `pick()` and `extend()`:

```ts
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const Invite = n.object({ email: Email, seats: PositiveInteger });

Invite.partial().parse({ seats: 3 }); // { ok: true, value: { seats: PositiveInteger } }
Invite.pick('email').keys; // ['email']
Invite.extend({ owner: Email }).keys; // ['email', 'seats', 'owner']
```

See also: [How to read configuration from environment variables](../guides/core/read-config.md), [How to check a request body with n.object()](../guides/core/check-an-object.md#check-a-patch-body).

## n.union()

```ts
n.union(key, variants): UnionSchema<UnionInput<Key, Variants>, UnionValue<Key, Variants>>
```

| Parameter  | Type                           | Description                                                        |
| ---------- | ------------------------------ | ------------------------------------------------------------------ |
| `key`      | `string`                       | The field that holds the tag.                                      |
| `variants` | `Record<string, ObjectSchema>` | Maps each tag to the [`n.object()`](#nobject) schema of its shape. |

Returns: a [`UnionSchema`](#unionschema).

What it does with an input:

1. It refuses anything that isn't an object, arrays included: `must be an object (was "x")`.
2. It reads the tag from the input's own `key`. A missing tag, or one no variant has, gives one issue under the key: `must be one of "card", "invoice" (was "cash")`. With one variant, the message is `must be "card" (was …)`.
3. It checks the input with the variant of that tag, and only that one. Issues have paths from the top of the input.
4. It returns the variant's value with the tag under `key`, as its first field. A variant need not declare `key`; a field it declares under `key` is replaced by the tag.

Tags are strings, compared with `===`: `'Card'` is not `'card'`, and `1` is not `'1'`. A variant keeps its `strict()`, `partial()` and constraints.

The type of the value is a union of one object per variant, each with its tag under `key`. Checking `value[key]` narrows it to one variant.

Throws a `TypeError`:

| Case                                         | Message                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| no variants                                  | `n.union(): list at least one variant`                                    |
| a variant that is not an `n.object()` schema | `n.union(): the variant "card" must be an n.object() schema (was object)` |
| a key that is not a string, or `__proto__`   | `n.union(): the key must be a string other than __proto__ (was 1)`        |

Example:

```ts
import { Email, n, NonBlankString } from '@horizon-republic/nominal-types';

const Payment = n.union('method', {
  card: n.object({ token: NonBlankString }),
  invoice: n.object({ email: Email }),
});

Payment.parse({ method: 'card', token: 'tok_1' });
// { ok: true, value: { method: 'card', token: NonBlankString } }
Payment.parse({ method: 'cash' });
// { ok: false, issues: [{ message: 'must be one of "card", "invoice" (was "cash")', path: ['method'] }] }
```

Its JSON Schema is a `oneOf` of the variants. In each, `properties[key]` is `{ const: tag }` and `key` is required. For OpenAPI 3.0, which has no `const`, it is `{ type: 'string', enum: [tag] }`, and the schema adds `discriminator: { propertyName: key }`.

See also: [How to accept one of several object shapes](../guides/core/accept-one-of-several-shapes.md).

## UnionSchema

The class `n.union()` returns. It extends [`TypeSchema`](#typeschema), so `parse()`, `accepts()`, `toPlain()`, `stringify()`, `array()`, `optional()`, `nullable()` and `['~standard']` work on it. `stringify()` writes the tag first, then the fields of its variant; an object whose tag no variant has is written by `JSON.stringify()`. It is a field of `n.object()` and a rule of [`Nominal()`](declaring.md#nominal), whose instance holds the union in `value`. It adds:

| Member | Description                                      |
| ------ | ------------------------------------------------ |
| `key`  | The field that holds the tag.                    |
| `tags` | The tags, in the order the variants were listed. |

```ts
import { Email, n, NonBlankString } from '@horizon-republic/nominal-types';

const Payment = n.union('method', {
  card: n.object({ token: NonBlankString }),
  invoice: n.object({ email: Email }),
});

Payment.key; // 'method'
Payment.tags; // ['card', 'invoice']
```

## n.record()

```ts
n.record(Key, Value): RecordSchema<RecordInput<Key, Value>, RecordValue<Key, Value>>
```

| Parameter | Type             | Description                                                                                                                                        |
| --------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Key`     | a type or schema | Checks each key: a nominal type of strings, `n.oneOf()` of strings, or another schema of strings.                                                  |
| `Value`   | a type or schema | Checks each value: a nominal type, an `n.of()`, `n.object()`, `n.union()`, `n.record()` or `n.tuple()` schema, or any synchronous Standard Schema. |

Returns: a [`RecordSchema`](#recordschema).

What it does with an input:

1. It refuses anything that isn't an object, arrays included: `must be an object (was array)`.
2. It counts the input's own keys and refuses a count outside [`min()` and `max()`](#recordschema) before it reads any key.
3. It checks every key with `Key`. A bad key gives one issue under that key: `key must be an ISO 4217 currency code (was "euro")`.
4. It checks every value with `Value`. Issues have paths from the top of the input: `['EUR']`, `['EUR', 'amount']`.
5. It returns a new object of the values, under the keys `Key` gave.

Keys:

| Key schema                                        | Which keys                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| a nominal type, such as `CurrencyCode`            | any key the type accepts; none is required                                                                 |
| `n.oneOf('s', 'm', 'l')`                          | only the listed keys, and every one of them is required, as in a TypeScript `Record<'s' \| 'm' \| 'l', V>` |
| `n.oneOf(...)` after [`partial()`](#recordschema) | only the listed keys, each one may be missing                                                              |

More rules:

- A key named `__proto__` is refused: `is not allowed`. `constructor` and `prototype` are plain keys.
- A value given as `undefined` counts as a missing key. When `Value` accepts `undefined`, such as `n.of(Type).optional()`, every key may be missing.
- When `Key` changes a key, for example with [`trimStrings`](configure.md), two keys that become one are refused: `must not repeat a key`.
- Only the input's own string keys are read.

The type of the value is `Readonly<Record<string, Value>>` for a nominal type of keys, and an object with the listed keys for `n.oneOf()`.

Throws a `TypeError`:

| Case                                                | Message                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| a key or value that is not a nominal type or schema | `n.record(): the key must be a nominal type or a schema (was "key")` |
| a key schema whose values are not strings           | `n.record(): the key must be a type or schema of strings`            |
| `__proto__` among the listed keys                   | `n.record(): a key cannot be named __proto__`                        |

Example:

```ts
import { CurrencyCode, DecimalString, n } from '@horizon-republic/nominal-types';

const Prices = n.record(CurrencyCode, DecimalString);

Prices.parse({ EUR: '12.50', USD: '13.10' });
// { ok: true, value: { EUR: DecimalString, USD: DecimalString } }
Prices.parse({ euro: '12.50' });
// { ok: false, issues: [{ message: 'key must be an ISO 4217 currency code (was "euro")', path: ['euro'] }] }
```

Its JSON Schema is `{ type: 'object', propertyNames, additionalProperties }`: the key schema and the value schema. For OpenAPI 3.0, which has no `propertyNames`, it leaves that keyword out. With listed keys it is `properties` with every key, `required` and `additionalProperties: false`. `min()` and `max()` add `minProperties` and `maxProperties`.

See also: [How to check a request body with n.object()](../guides/core/check-an-object.md#check-an-object-with-any-keys).

## RecordSchema

The class `n.record()` returns. It extends [`TypeSchema`](#typeschema), so `parse()`, `accepts()`, `toPlain()`, `stringify()`, `array()`, `optional()`, `nullable()` and `['~standard']` work on it. It is a field of `n.object()` and a rule of [`Nominal()`](declaring.md#nominal), whose instance holds the record, frozen, in `value`. It adds:

| Member       | Description                                                                             |
| ------------ | --------------------------------------------------------------------------------------- |
| `keys`       | The listed keys for an `n.oneOf()` key schema, `undefined` otherwise.                   |
| `min(count)` | A new schema that refuses fewer keys than `count`: `must have at least 1 key (was 0)`.  |
| `max(count)` | A new schema that refuses more keys than `count`: `must have at most 50 keys (was 51)`. |
| `partial()`  | A new schema whose listed keys may be missing.                                          |

`min()` and `max()` throw a `TypeError` for a count that is not a whole number from 0 up, and when the lower limit would be above the upper one.

```ts
import { n, NonEmptyString, PositiveInteger, Url } from '@horizon-republic/nominal-types';

const Links = n.record(NonEmptyString, Url).min(1).max(50);
const Sizes = n.record(n.oneOf('s', 'm', 'l'), PositiveInteger);

Sizes.keys; // ['s', 'm', 'l']
Sizes.parse({ m: 2 }).ok; // false: s and l are required
Sizes.partial().parse({ m: 2 }).ok; // true
```

## n.tuple()

```ts
n.tuple([A, B, ...], Rest?): TupleSchema<TupleValue<Items, Rest, 'input'>, TupleValue<Items, Rest>>
```

| Parameter | Type                         | Description                                                                 |
| --------- | ---------------------------- | --------------------------------------------------------------------------- |
| `items`   | an array of types or schemas | Checks the item at each position, in order.                                 |
| `Rest`    | a type or schema             | Optional. Checks every item past the positions. Without it, there are none. |

Returns: a [`TupleSchema`](#tupleschema).

What it does with an input:

1. It refuses anything that isn't an array: `must be an array (was object)`.
2. It counts the items before it checks any: `must have 2 items (was 3)`, or `must have at least 1 item (was 0)` with `Rest` or optional items.
3. It checks each item with the schema of its position, and every further item with `Rest`. Issues have the index in their path: `[1]`, `[1, 'id']`.
4. It returns a new array of the values.

Trailing positions whose schema accepts `undefined`, such as `n.of(Type).optional()`, may be left out: `n.tuple([PositiveInteger, n.of(PositiveInteger).optional()])` takes `[1]` and `[1, 2]`. An optional position before a required one must be given, as `undefined` or a value.

The type of the value is a read-only TypeScript tuple: `readonly [Latitude, Longitude]`, `readonly [AnyString, ...AnyString[]]`.

Throws a `TypeError`:

| Case                                         | Message                                                             |
| -------------------------------------------- | ------------------------------------------------------------------- |
| items that are not an array                  | `n.tuple(): list the items in an array (was "x")`                   |
| an item that is not a nominal type or schema | `n.tuple(): the item 1 must be a nominal type or a schema (was 1)`  |
| a rest that is not a nominal type or schema  | `n.tuple(): the rest must be a nominal type or a schema (was null)` |

Example:

```ts
import { AnyString, Latitude, Longitude, n } from '@horizon-republic/nominal-types';

const Point = n.tuple([Latitude, Longitude]);
const Command = n.tuple([AnyString], AnyString);

Point.parse([50.45, 30.52]); // { ok: true, value: [Latitude, Longitude] }
Point.parse([50.45]); // { ok: false, issues: [{ message: 'must have 2 items (was 1)' }] }
Command.parse(['git', 'commit']).ok; // true
```

Its JSON Schema lists the positions as `prefixItems` in draft 2020-12 and as an `items` array in draft-07, with `items: false` (`additionalItems: false`) or the schema of `Rest`, and `minItems` and `maxItems`. OpenAPI 3.0 has no tuples, so there each item is `anyOf` the item schemas, with the same counts.

See also: [How to check lists and optional values](../guides/core/lists-and-optional-values.md#check-a-list-of-fixed-positions).

## TupleSchema

The class `n.tuple()` returns. It extends [`TypeSchema`](#typeschema), so `parse()`, `accepts()`, `toPlain()`, `stringify()`, `array()`, `optional()`, `nullable()` and `['~standard']` work on it. It is a field of `n.object()` and a rule of [`Nominal()`](declaring.md#nominal), whose instance holds the tuple, frozen, in `value`.

```ts
import { Latitude, Longitude, n, Nominal } from '@horizon-republic/nominal-types';

export class Point extends Nominal('geo.Point', n.tuple([Latitude, Longitude])) {}

new Point([50.45, 30.52]).value[0]; // Latitude
```

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

## n.plain()

```ts
n.plain(value: Value): Plain<Value>
```

| Parameter | Type | Description                          |
| --------- | ---- | ------------------------------------ |
| `value`   | any  | The value to turn into plain values. |

Returns: a new copy of `value` with plain values only:

| Part of the value                                                     | Result                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| an instance, also one from [another copy of the package](glossary.md) | what its [`toJSON()`](type-members.md#tojson-and-tostring) returns, converted again if it is an object |
| an array or a plain object                                            | a new one, with each part converted                                                                    |
| a `Date`, a `Map`, an instance of a class of your own                 | kept as it is                                                                                          |
| a string, a number or any other primitive                             | kept as it is                                                                                          |

`value` stays as it was.

Throws: a `TypeError` if `value` refers to itself, which JSON can't write either: `n.plain(): the value refers to itself, which JSON cannot write`.

Use it for a response that doesn't come from one schema. For a value from a schema's `parse()`, [`toPlain()`](#toplain) and [`stringify()`](#stringify) are faster, since they know where the instances are.

Example:

```ts
import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';

const page = {
  items: [{ email: new Email('jane@example.com'), seats: new PositiveInteger(2) }],
  total: 1,
};

n.plain(page); // { items: [{ email: 'jane@example.com', seats: 2 }], total: 1 }
```

`Plain<Value>` is the type of the result: `Value` with each instance replaced by the type its `toJSON()` returns. For `Email` that is `string`, for `Int64` it is `string` as well.

[← Reference](README.md)
