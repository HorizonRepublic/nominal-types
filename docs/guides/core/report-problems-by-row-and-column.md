# How to report problems by row and column

This guide shows how to check a spreadsheet import and report each problem at its row and column, such as "row 3, column `sku`: repeats an earlier SKU".

A type checks one value, and a [constraint](../../reference/glossary.md) checks the fields of one object. A [rule](../../reference/glossary.md) made with `n.rule()` reads the whole list and reports as many problems as it finds.

## Check each row

Declare a type for a row, then a list of rows:

```ts
import { n, Nominal, NonEmptyString, PositiveInteger } from '@horizon-republic/nominal-types';

class Row extends Nominal('shop.Row', n.object({ sku: NonEmptyString, quantity: PositiveInteger })) {}

const Sheet = n.of(Row).array({ max: 10_000 });

Sheet.parse([
  { sku: 'MUG-01', quantity: 0 },
  { sku: '', quantity: 1 },
]);
// { ok: false, issues: [
//   { message: 'must be a positive integer (was 0)', path: [0, 'quantity'] },
//   { message: 'must be a non-empty string (was "")', path: [1, 'sku'] },
// ] }
```

Each issue has a `path`: the index of the row, then the column. Row 0 is the first row.

## Report problems across rows

Some problems need more than one row, such as a SKU used twice. Write a rule with `n.rule()` and add it with `check()`:

```ts
import { n, Nominal, NonEmptyString, PositiveInteger } from '@horizon-republic/nominal-types';

class Row extends Nominal('shop.Row', n.object({ sku: NonEmptyString, quantity: PositiveInteger })) {}

const uniqueSku = n.rule((rows: readonly Row[], report) => {
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    if (seen.has(row.sku.value)) {
      report({ path: [index, 'sku'], code: 'duplicate_sku', message: 'repeats an earlier SKU' });
    }

    seen.add(row.sku.value);
  });
});

const Sheet = n.of(Row).array({ max: 10_000 }).check(uniqueSku);

Sheet.parse([
  { sku: 'MUG-01', quantity: 2 },
  { sku: 'CAP-07', quantity: 1 },
  { sku: 'MUG-01', quantity: 5 },
]);
// { ok: false, issues: [{ code: 'duplicate_sku', message: 'repeats an earlier SKU', path: [2, 'sku'] }] }
```

The rule gets the rows as `Row` instances. Call `report()` once for each problem. Each call adds one issue:

| Field     | What it sets                                       | Without it           |
| --------- | -------------------------------------------------- | -------------------- |
| `path`    | Where the problem is: `[row, column]`              | the list itself      |
| `code`    | A name of your own, such as `duplicate_sku`        | no code on the issue |
| `message` | The message                                        | `is invalid`         |
| `params`  | Values for a translated message, see the next part | nothing              |

A code you give is always on the issue, so your code and your front end can tell the problems apart.

## Translate the message

Give the message for your code to [`n.configure()`](../../reference/configure.md#messages), in the same map as the built-in codes. The `params` of `report()` reach the message function:

```ts
import { n, Nominal, NonEmptyString, PositiveInteger } from '@horizon-republic/nominal-types';

class Row extends Nominal('shop.Row', n.object({ sku: NonEmptyString, quantity: PositiveInteger })) {}

const uniqueSku = n.rule((rows: readonly Row[], report) => {
  const firstRow = new Map<string, number>();

  rows.forEach((row, index) => {
    const first = firstRow.get(row.sku.value);

    if (first === undefined) {
      firstRow.set(row.sku.value, index);
    } else {
      report({ path: [index, 'sku'], code: 'duplicate_sku', params: { row: first + 1 } });
    }
  });
});

const Sheet = n.of(Row).array({ max: 10_000 }).check(uniqueSku);

n.configure({
  messages: {
    duplicate_sku: ({ params }) => `wiederholt die SKU aus Zeile ${String(params?.['row'])}`,
  },
});

Sheet.parse([
  { sku: 'MUG-01', quantity: 2 },
  { sku: 'CAP-07', quantity: 1 },
  { sku: 'MUG-01', quantity: 5 },
]);
// { ok: false, issues: [{ code: 'duplicate_sku', message: 'wiederholt die SKU aus Zeile 1', path: [2, 'sku'] }] }
```

A message set for the code replaces the `message` of `report()`. The `params` stay out of the issue.

## Know when a rule runs

A rule runs only when every row passed its own check. While a row fails, you get the issues of the rows, and the rule doesn't run. So a rule never sees a missing or wrong value.

Several rules run in the order you give them, and their issues follow in that order: `Sheet.check(uniqueSku, rowLimit)`.

## Check a list inside an object

The path of the list goes in front of the paths the rule reports:

```ts
import { n, Nominal, NonEmptyString, PositiveInteger } from '@horizon-republic/nominal-types';

class Row extends Nominal('shop.Row', n.object({ sku: NonEmptyString, quantity: PositiveInteger })) {}

const uniqueSku = n.rule((rows: readonly Row[], report) => {
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    if (seen.has(row.sku.value)) {
      report({ path: [index, 'sku'], code: 'duplicate_sku', message: 'repeats an earlier SKU' });
    }

    seen.add(row.sku.value);
  });
});

const Upload = n.object({
  file: NonEmptyString,
  rows: n.of(Row).array({ max: 10_000 }).check(uniqueSku),
});

Upload.parse({
  file: 'march.csv',
  rows: [
    { sku: 'MUG-01', quantity: 2 },
    { sku: 'MUG-01', quantity: 5 },
  ],
});
// { ok: false, issues: [{ code: 'duplicate_sku', message: 'repeats an earlier SKU', path: ['rows', 1, 'sku'] }] }
```

The adapters pass the issues on as they are. The NestJS pipe answers `400` with `message: ['rows.1.sku: repeats an earlier SKU']`, and the Fastify validation error has `instancePath: '/rows/1/sku'`.

## Limit the number of issues

A file of 10,000 bad rows would give tens of thousands of issues. So a check stops after 100 issues and adds one more that says so:

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

Set [`maxIssues`](../../reference/configure.md#maxissues) for your app. `Infinity` reports every issue.

## Write a short rule in place

`check()` also takes a function. TypeScript then knows the type of the value:

```ts
import { n, PositiveInteger } from '@horizon-republic/nominal-types';

const Quantities = n
  .of(PositiveInteger)
  .array()
  .check((counts) => counts.reduce((sum, count) => sum + count.value, 0) <= 100 || 'must add up to 100 at most');

Quantities.parse([60, 50]); // { ok: false, issues: [{ message: 'must add up to 100 at most' }] }
```

A rule may return a result instead of calling `report()`:

| Return            | Result                                                               |
| ----------------- | -------------------------------------------------------------------- |
| `true` or nothing | no issue                                                             |
| `false`           | one issue, with the `message`, `code` and `path` of the rule options |
| a string          | one issue, with that string as its message                           |

`check()` works on `n.object()`, `n.record()`, `n.tuple()` and every schema `n.of()` builds.

## Limits

- A rule is synchronous, like every check of this package.
- The JSON Schema doesn't change: JSON Schema can't express a rule.
- `values: 'hide'` doesn't change `params`. Leave out of them what must not show in a message.

## See also

- [Schemas](../../reference/schemas.md#nrule): `n.rule()` and `check()`.
- [n.configure()](../../reference/configure.md#maxissues): `maxIssues` and `messages`.
- [How to check one field against another](check-fields-together.md)

[← Guides](../README.md)
