# Type members

What every nominal type class and every instance offers. A type of your own and a built-in type have the same members. Terms are explained in the [glossary](glossary.md).

## Static members

| Member                                 | Description                                                         |
| -------------------------------------- | ------------------------------------------------------------------- |
| [`new Type(input)`](#new)              | Checks `input` and makes an instance. Throws if `input` is invalid. |
| [`Type.parse(input)`](#parse)          | Checks `input`. Returns a result object and doesn't throw.          |
| [`Type.accepts(input)`](#accepts)      | Tells whether `parse()` would accept `input`. Makes no instance.    |
| [`Type.stringify(value)`](#stringify)  | The JSON text of an instance.                                       |
| [`value instanceof Type`](#instanceof) | Tells whether a value is an instance of the type.                   |
| [`Type.typeName`](#typename)           | The [type name](declaring.md#type-names).                           |
| [`Type.rule`](#rule)                   | The rule the type's own level adds.                                 |
| [`Type['~standard']`](#standard)       | The Standard Schema and Standard JSON Schema interface.             |
| `Type.subtype(name, rule?, options?)`  | A narrower type. See [`subtype()`](declaring.md#subtype).           |
| `Type.variant(name, rule, options?)`   | A sibling type. See [`variant()`](declaring.md#variant).            |

### new

```ts
new Type(input): Type
```

| Parameter | Type                       | Description         |
| --------- | -------------------------- | ------------------- |
| `input`   | the input type of the rule | The value to check. |

Returns: an instance holding the checked value.

Throws: [`NominalError`](errors-and-messages.md#nominalerror) if `input` breaks a rule.

`new` takes a plain value only. An instance passed to `new` is rejected like any other object. Use [`parse()`](#parse) to turn an instance of one type into another.

Example:

```ts
import { Email } from '@horizon-republic/nominal-types';

const email = new Email('jane@example.com');

email.value; // 'jane@example.com'
new Email('jane'); // throws NominalError: nominal.Email: must be an email address (was a string of 4 characters)
```

### parse

```ts
Type.parse(input: unknown): Parsed<Type>
```

| Parameter | Type      | Description         |
| --------- | --------- | ------------------- |
| `input`   | `unknown` | The value to check. |

Returns: `{ ok: true, value }` with the instance, or `{ ok: false, issues }` with the [issues](errors-and-messages.md#issues).

Throws: nothing for an invalid value. A class with a constructor of its own that changes the input before `super()` gets the issues of the changed input, not a `NominalError`. A rule that answers asynchronously throws a `TypeError`, see [Rules from other libraries](declaring.md#rules-from-other-libraries).

Example:

```ts
import { Uuid } from '@horizon-republic/nominal-types';

const result = Uuid.parse('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');

if (result.ok) {
  result.value.version; // 7
}

Uuid.parse('nope'); // { ok: false, issues: [{ message: 'must be a UUID (was "nope")' }] }
```

What `parse()` does with an instance of a nominal type:

| Input                                                                | Result                                        |
| -------------------------------------------------------------------- | --------------------------------------------- |
| an instance of the same type, or of a type under it                  | returned as it is, without a check            |
| an instance of a type above it                                       | its value is checked against the type's rules |
| an instance of a type that [implies](glossary.md) it                 | its value is checked against the type's rules |
| an instance of a variant, or of the type a variant was made from     | its value is checked against the type's rules |
| an instance of a [sibling](glossary.md): a type with a common parent | its value is checked against the type's rules |
| an instance of an unrelated type: no common parent                   | rejected like any other object                |

All built-in string types share the parent `AnyString`. So `Sku.parse(email)` checks the text of the email against the rules of `Sku`.

An instance is returned without a check only when this copy of the package built it with `new` or `parse()`, and its value is still the one it was built with. Any other object that passes `instanceof` gets its `value` checked against the type's rules, and `parse()` returns a new instance:

- an instance made by [another copy of the package](glossary.md);
- an instance of another type declared with the same [type name](declaring.md#type-names);
- an instance of the parent of a class that extends a type, such as an `Email` given to `class StaffEmail extends Email`;
- an instance whose `value` was changed by JavaScript code;
- a plain object that carries the brand, or one made with `Object.create(Email.prototype)`.

So `parse()` is the check to trust. `instanceof` only reads the brand.

Example:

```ts
import { AnyString, Email } from '@horizon-republic/nominal-types';

class StaffEmail extends Email.subtype('shop.StaffEmail', /@example\.com$/u) {}
class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const staff = new StaffEmail('jane@example.com');

Email.parse(staff); // { ok: true, value: staff }, the same instance
StaffEmail.parse(new Email('jane@example.com')); // { ok: true, value: StaffEmail }
StaffEmail.parse(new Email('jane@gmail.com')); // { ok: false, issues: [{ message: 'must be matched by @example\\.com$ (was a string of 14 characters)' }] }
Sku.parse(new Email('jane@example.com')); // { ok: false, issues: [{ message: 'must be matched by ^[A-Z]{3}-\\d{4}$ (was "jane@example.com")' }] }
```

See also: [How to check untrusted input](../guides/core/check-input.md).

### accepts

```ts
Type.accepts(input: unknown): boolean
```

| Parameter | Type      | Description         |
| --------- | --------- | ------------------- |
| `input`   | `unknown` | The value to check. |

Returns: `true` if `parse()` would accept `input`, `false` otherwise.

Throws: nothing for an invalid value. A rule that answers asynchronously throws a `TypeError`, as in `parse()`.

`accepts()` runs the same rules as `parse()`, but it makes no instance and no issues. Use it when you only need a yes or no, such as to filter a list. It is several times faster than `parse()`: see [Benchmarks](benchmarks.md#one-value).

It treats an instance as [`parse()`](#parse) does. It differs from `parse()` in two ways:

- It doesn't run a constructor of your own. A class whose constructor changes or refuses the input can get `true` from `accepts()` and issues from `parse()`.
- It doesn't change the type of `input`. A string it accepts is still a `string` to TypeScript, not an instance. To get an instance, call `parse()`.

Example:

```ts
import { Email, Integer } from '@horizon-republic/nominal-types';

Integer.accepts(42); // true
Integer.accepts(4.2); // false
Email.accepts(new Email('jane@example.com')); // true

const inputs: unknown[] = ['jane@example.com', 'jane', 42];

inputs.filter((input) => Email.accepts(input)); // ['jane@example.com']
```

### stringify

```ts
Type.stringify(value: Instance): string
```

| Parameter | Type                    | Description                    |
| --------- | ----------------------- | ------------------------------ |
| `value`   | an instance of the type | The instance to write as JSON. |

Returns: the text `JSON.stringify(value)` gives.

Throws: a `TypeError` if JSON has no text for `value`, such as `undefined`: `stringify(): JSON has no text for undefined`.

For a type built on [`n.object()`](schemas.md#nobject), it writes the instance with the object schema's [`stringify()`](schemas.md#stringify), which is several times faster than `JSON.stringify()`. The fields come in the order they were declared. For any other type, it calls `JSON.stringify()`.

An instance whose `value` you reassigned is written from its new value, as `JSON.stringify()` writes it.

Example:

```ts
import { n, Nominal, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';

class Stay extends Nominal('booking.Stay', n.object({ guests: PositiveInteger, room: Uuid })) {}

const stay = new Stay({ room: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', guests: 2 });

Stay.stringify(stay); // '{"guests":2,"room":"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"}'
Uuid.stringify(stay.room); // '"0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"'
```

### instanceof

```ts
value instanceof Type
```

`true` if `value` is an instance of `Type`, of a type under it or of a type that [implies](glossary.md) `Type`. A parent instance is not an instance of a subtype. A variant and its source are not instances of each other.

It also works for an instance made by [another copy of the package](glossary.md), such as one loaded with `import` and one with `require`.

`instanceof` reads the [brand](glossary.md) only. An object can carry the brand without holding a valid value, and two types with one type name pass for each other. To know that a value is valid, use [`parse()`](#parse).

Example:

```ts
import { Email } from '@horizon-republic/nominal-types';

class StaffEmail extends Email.subtype('shop.StaffEmail', /@example\.com$/u) {}

const value: unknown = new StaffEmail('jane@example.com');

value instanceof Email; // true
new Email('jane@example.com') instanceof StaffEmail; // false

if (value instanceof Email) {
  value.domain; // 'example.com'
}
```

### typeName

```ts
Type.typeName: string
```

The name given when the type was declared. `NominalError` and the JSON Schema `title` use it.

```ts
import { Email } from '@horizon-republic/nominal-types';

class StaffEmail extends Email.subtype('shop.StaffEmail', /@example\.com$/u) {}

StaffEmail.typeName; // 'shop.StaffEmail'
Email.typeName; // 'nominal.Email'
```

### rule

```ts
Type.rule: NominalSchema
```

The rule of the type's own level. A type that adds no rule, such as `subtype('shop.Port')` without a rule, returns the rule of the closest type above it.

`Type.rule` is not the whole check. For a schema that runs every rule of the type, use [`n.of(Type)`](schemas.md#nof).

A class that extends a type can set `static rule`. See [A `rule` set in a subclass](declaring.md#a-rule-set-in-a-subclass).

### ~standard

```ts
Type['~standard']: StandardProps<Input, Type>
```

Makes the class a [Standard Schema](glossary.md) and a [Standard JSON Schema](glossary.md). Libraries that accept a Standard Schema read it.

| Member                       | Value                                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| `version`                    | `1`                                                                |
| `vendor`                     | `'@horizon-republic/nominal-types'`                                |
| `validate(value)`            | `{ value }` with the instance, or `{ issues }`. Never a `Promise`. |
| `jsonSchema.input(options)`  | The JSON Schema of the input. See [JSON Schema](json-schema.md).   |
| `jsonSchema.output(options)` | The JSON Schema of the output. See [JSON Schema](json-schema.md).  |

Example:

```ts
import { Email } from '@horizon-republic/nominal-types';

Email['~standard'].validate('jane'); // { issues: [{ message: 'must be an email address (was a string of 4 characters)' }] }
Email['~standard'].validate('jane@example.com'); // { value: Email }
```

## Instance members

| Member                                      | Description                                                      |
| ------------------------------------------- | ---------------------------------------------------------------- |
| [`value`](#value)                           | The checked value.                                               |
| [`equals(other)`](#equals)                  | Compares by value within one [line of types](glossary.md).       |
| [`toJSON()`](#tojson-and-tostring)          | The value, for `JSON.stringify`.                                 |
| [`toString()`](#tojson-and-tostring)        | The value as text.                                               |
| [`[Symbol.toPrimitive]`](#primitive-values) | Makes the instance work in `>`, `Number()` and template strings. |
| [`console.log()` form](#in-consolelog)      | `Email { value: … }`, with the value of a sensitive type hidden. |

A built-in type adds its own members, such as `email.domain`. See [Built-in types](types/README.md).

### value

```ts
instance.value: Immutable<Value>
```

The value the instance holds. It passed every rule of the type when the instance was made.

What keeps it from changing:

| Part of the instance                      | Protected by                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `value` itself                            | TypeScript: `value` is `readonly`. JavaScript code can still assign it.                          |
| an object or array value                  | `Object.freeze`, all the way down. The input stays yours: the type freezes a copy.               |
| instances, dates and class objects inside | nothing: they are not frozen.                                                                    |
| fields a class of your own adds           | nothing: the instance itself is not frozen, so a class that extends a type can add fields to it. |

An instance whose `value` was changed is not trusted: [`parse()`](#parse) checks it again.

### equals

```ts
instance.equals(other: unknown): boolean
```

| Parameter | Type      | Description           |
| --------- | --------- | --------------------- |
| `other`   | `unknown` | The value to compare. |

Returns `true` when both:

- `other` is in the same line of types: an instance of the same type, a type under it, a type above it, a type it implies or a type that implies it;
- the values are the same.

How values are compared:

| Value                      | Compared with                                                  |
| -------------------------- | -------------------------------------------------------------- |
| a primitive                | `Object.is`, so `-0` doesn't equal `0`, and `NaN` equals `NaN` |
| an array                   | item by item                                                   |
| a plain object             | key by key                                                     |
| an instance inside a value | its own `equals()`                                             |
| a `Uuid`                   | ignoring case                                                  |
| a date or time type        | Temporal's `equals()`: the same moment, date or time           |

A variant and its source are not equal. A plain value, such as a string, is never equal to an instance.

Example:

```ts
import { Email } from '@horizon-republic/nominal-types';

class StaffEmail extends Email.subtype('shop.StaffEmail', /@example\.com$/u) {}

const email = new Email('jane@example.com');

email.equals(new Email('jane@example.com')); // true
email.equals(new StaffEmail('jane@example.com')); // true
email.equals('jane@example.com'); // false
email === new Email('jane@example.com'); // false
```

### toJSON and toString

```ts
instance.toJSON(): unknown
instance.toString(): string
```

| Method       | Returns                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `toJSON()`   | The value. `AnyBigInt` and the types under it return a decimal string. The date and time types return their text. |
| `toString()` | `String(value)`, or JSON text for an object or array value. The date and time types return their text.            |

Example:

```ts
import { Email, Int64, PositiveInteger } from '@horizon-republic/nominal-types';

const email = new Email('jane@example.com');
const quantity = new PositiveInteger(3);
const id = new Int64(9007199254740993n);

JSON.stringify({ email, quantity, id }); // '{"email":"jane@example.com","quantity":3,"id":"9007199254740993"}'
email.toString(); // 'jane@example.com'
```

`JSON.stringify()` calls `toJSON()` on each instance, which makes it several times slower than on plain values. For a large response, write it with a schema's [`stringify()`](schemas.md#stringify), or convert it first with [`n.plain()`](schemas.md#nplain).

### Primitive values

An instance stands for its value where JavaScript asks for a plain value:

| Expression       | Value is a string, number, bigint or boolean | Value is an object or array |
| ---------------- | -------------------------------------------- | --------------------------- |
| `` `${email}` `` | the value as text                            | JSON text, `{"guests":2}`   |
| `b > a`          | compares the values                          | throws a `TypeError`        |
| `Number(a)`      | the value as a number                        | throws a `TypeError`        |

The `TypeError` reads `booking.Stay holds an object and has no primitive value; compare its fields through .value`.

The [date and time types](types/temporal.md) give their text in a string. Elsewhere they throw a `TypeError` that names the function to compare with: `nominal.Instant holds a Temporal.Instant and has no primitive value; compare with Temporal.Instant.compare(a.value, b.value)`.

TypeScript accepts `>` and `<` between two instances. It refuses them between an instance and a plain number, and it refuses `+`, `-`, `*` and `/` on an instance. Read `.value` there.

Example:

```ts
import { Email, PositiveInteger } from '@horizon-republic/nominal-types';

const email = new Email('jane@example.com');
const quantity = new PositiveInteger(3);

`Sent to ${email}`; // 'Sent to jane@example.com'
new PositiveInteger(5) > quantity; // true
quantity.value <= 10; // true
Number(quantity) + 1; // 4
quantity.value * 2; // 6
```

### In console.log

`console.log()` and `util.inspect()` in Node.js and Bun show the class name and the value. A [sensitive type](errors-and-messages.md#sensitive-types) shows the kind of its value instead.

Example:

```ts
import { Email, PositiveInteger } from '@horizon-republic/nominal-types';

console.log(new PositiveInteger(3)); // PositiveInteger { value: 3 }
console.log(new Email('jane@example.com')); // Email { value: <hidden, a string of 16 characters> }
```

## Members of a type built on n.object()

A type whose rule is an [`n.object()`](schemas.md#nobject) schema adds two members to its instances:

| Member              | Description                                                                           |
| ------------------- | ------------------------------------------------------------------------------------- |
| a getter per field  | `stay.guests` reads `stay.value.guests`.                                              |
| `copyWith(changes)` | A new instance with the given fields changed and the others kept. Checked like `new`. |

`copyWith()` throws [`NominalError`](errors-and-messages.md#nominalerror) when the result breaks a rule. It also throws when `changes` has a key the object doesn't declare: `booking.Stay: rooms: is not allowed`. TypeScript refuses such a key too. The instance it was called on stays as it was.

`copyWith()` builds the copy with `new` on the instance's own class, and gives it the whole changed object. A class of your own with its own constructor must take that object as its first argument.

A subtype of such a type keeps the getters and `copyWith()`.

A field can't be named `value`, `equals`, `copyWith`, `toJSON`, `toString` or `constructor`. `Nominal()` throws a `TypeError` for them:

```
TypeError: a type built on n.object() cannot have a field named value: every instance has a member of that name
```

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

const stay = new Stay({ guests: 2, capacity: 4 });

stay.guests.value; // 2
stay.copyWith({ guests: 3 }).guests.value; // 3
stay.copyWith({ guests: 5 }); // throws NominalError: booking.Stay: guests: must not exceed the capacity
`${stay}`; // '{"guests":2,"capacity":4}'
Number(stay); // throws TypeError: booking.Stay holds an object and has no primitive value; compare its fields through .value
```

See also: [How to make a value object](../guides/core/make-a-value-object.md).

[← Reference](README.md)
