# How to read numbers and booleans from text

This guide shows how to turn text into number and boolean types: query strings, form fields and CSV cells. For environment variables, see [How to read configuration from environment variables](read-config.md).

## Read one value

Call `.fromString()` on `schemaOf(Type)`:

```ts
import { schemaOf, Uint16 } from '@horizon-republic/nominal-types';

const Port = schemaOf(Uint16).fromString();

Port.parse('8080'); // { ok: true, value: Uint16 { value: 8080 } }
Port.parse('70000'); // { ok: false, issues: [{ message: 'must be an unsigned 16-bit integer (was 70000)' }] }
Port.parse('80a'); // { ok: false, issues: [{ message: 'must be a number (was "80a")' }] }
Port.parse(8080); // { ok: true, value: Uint16 { value: 8080 } }
```

Without `fromString()`, the text `'8080'` is rejected: `must be a number (was "8080")`.

Numbers are read as JSON writes them, such as `'2'`, `'-1.5'` and `'1e3'`. Booleans are read from `'true'` and `'false'` only. Other text, such as `'02'`, `' 2'` or `'yes'`, is rejected with the type's message. String and big integer types take text as it is. [Schemas](../../reference/schemas.md) lists every case.

## Read a query string

Describe the parameters with `objectOf()` and call `.fromEnv()`. Each field of a number, boolean, big integer or string type is read from text:

```ts
import { AnyBoolean, AnyString, objectOf, PositiveInteger, schemaOf } from '@horizon-republic/nominal-types';

const SearchQuery = objectOf({
  page: PositiveInteger,
  inStock: AnyBoolean,
  q: schemaOf(AnyString).optional(),
}).fromEnv();

const url = new URL('https://shop.example/search?page=2&inStock=true&utm=mail');

SearchQuery.parse(Object.fromEntries(url.searchParams));
// { ok: true, value: { page: PositiveInteger { value: 2 }, inStock: AnyBoolean { value: true } } }
```

`fromEnv()` works for any object of strings, not only environment variables. Parameters the schema doesn't list, such as `utm`, are dropped.

## Read rows of a CSV file

Turn each row into an object of cells, then parse it with the same kind of schema:

```ts
import { AnyString, objectOf, PositiveInteger } from '@horizon-republic/nominal-types';

class Sku extends AnyString.subtype('shop.Sku', /^[A-Z]{3}-\d{4}$/u) {}

const Row = objectOf({ sku: Sku, quantity: PositiveInteger }).fromEnv();

const csv = 'sku,quantity\nABC-1234,2\nXYZ-0001,zero';
const [header = '', ...lines] = csv.split('\n');
const columns = header.split(',');

for (const line of lines) {
  const cells = Object.fromEntries(line.split(',').map((cell, index) => [columns[index], cell]));

  console.log(Row.parse(cells));
}
// { ok: true, value: { sku: Sku { value: 'ABC-1234' }, quantity: PositiveInteger { value: 2 } } }
// { ok: false, issues: [{ message: 'must be a number (was "zero")', path: ['quantity'] }] }
```

## Read a list

Call `.fromString()` before `.array()`, so each item is read:

```ts
import { PositiveInteger, schemaOf } from '@horizon-republic/nominal-types';

const Ids = schemaOf(PositiveInteger).fromString().array();

Ids.parse('3,5,8'.split(',')); // { ok: true, value: [PositiveInteger { value: 3 }, PositiveInteger { value: 5 }, PositiveInteger { value: 8 }] }
Ids.parse(['1', 'two']); // { ok: false, issues: [{ message: 'must be a number (was "two")', path: [1] }] }
```

The same order works for `.optional()` and `.nullable()`: `schemaOf(PositiveInteger).fromString().optional()`.

## Limits

`fromString()` throws a `TypeError` in two cases:

- after `.array()`, `.optional()` or `.nullable()`;
- for a type made with `Nominal()`, which has no text form. Declare it under a built-in type instead, as in [How to declare a type](declare-a-type.md).

The error text is in [How to fix common problems](fix-common-problems.md).

In NestJS, `NominalPipe` reads query and route strings for you. See [How to use nominal types with NestJS](../frameworks/nestjs.md).

## See also

- [Schemas](../../reference/schemas.md): `fromString()` and `fromEnv()`.
- [How to accept lists, missing values and null](lists-and-optional-values.md)

[← Guides](../README.md)
