# Dates and times

[Built-in types](README.md) › Dates and times

These four types come from their own [entry point](../glossary.md), `@horizon-republic/nominal-types/temporal`. Each one is a root, and its `value` is a [Temporal](../glossary.md) object.

| Type            | Holds                    | Text                   | Use it for                                  |
| --------------- | ------------------------ | ---------------------- | ------------------------------------------- |
| `Instant`       | `Temporal.Instant`       | `2024-05-01T09:30:00Z` | a moment: when an order was paid            |
| `PlainDate`     | `Temporal.PlainDate`     | `2024-05-01`           | a calendar date: a birthday, a due date     |
| `PlainTime`     | `Temporal.PlainTime`     | `09:30:00`             | a time of day: an opening hour              |
| `PlainDateTime` | `Temporal.PlainDateTime` | `2024-05-01T09:30:00`  | a date and time in no zone: a local meeting |

## Temporal in the runtime

The types use `Temporal` from the runtime. Node.js 26 has it. On Node.js 22 and 24, install a polyfill:

```shell
npm install temporal-polyfill
```

Then load it once, at the start of your program, before the first value is built:

```ts
// main.ts
import 'temporal-polyfill/global';
```

Importing the entry point works without `Temporal`. Building a value without it throws a `TypeError`:

```ts
import { Instant } from '@horizon-republic/nominal-types/temporal';

new Instant('2024-05-01T09:30:00Z');
// throws TypeError: nominal.Instant needs Temporal, which this runtime lacks: import 'temporal-polyfill/global' before the first value is built
```

## Common to the four types

Text must follow [RFC 3339](../glossary.md), the date and time format of the internet:

- `T` and `Z` are upper case. A space in place of `T` is refused.
- Years run from `0000` to `9999`, with four digits.
- The day must exist in its month: `2024-02-29` passes, `2023-02-29` and `2024-04-31` don't.
- Seconds are required: `09:30` is refused.
- A fraction of a second has 1 to 9 digits after a dot. A comma is refused.
- The leap second `:60` is refused.
- Week dates (`2021-W53-1`), day-of-year dates (`2009-130`), the compact form (`20240501T093000Z`) and zone names in brackets (`[Europe/Paris]`) are refused.

Other rules:

- Each type also takes a Temporal object of its own kind, such as a `Temporal.Instant`.
- `toJSON()` and `toString()` give the text Temporal writes.
- `equals()` compares the moment, date or time, not the text.
- Each type has a [text form](../glossary.md), so `fromString()` and `fromEnv()` read it.

Use `.value` to compare and calculate. The `>` and `<` operators throw a `TypeError`, since they would compare text:

```ts
import 'temporal-polyfill/global';
import { Instant, PlainDate } from '@horizon-republic/nominal-types/temporal';

const earlier = new Instant('2024-05-01T09:30:00Z');
const later = new Instant('2024-05-01T12:00:00+02:00');

Temporal.Instant.compare(earlier.value, later.value); // -1
earlier.value.until(later.value).total('minutes'); // 30
new PlainDate('2024-05-01').value.add({ days: 30 }).toString(); // '2024-05-31'
earlier < later;
// throws TypeError: nominal.Instant holds a Temporal.Instant and has no primitive value; compare with Temporal.Instant.compare(a.value, b.value)
```

## Instant

A moment on the global timeline, like `2024-05-01T09:30:00Z`.

- The offset is required: `Z` or a number of hours and minutes, such as `+02:00`. Offsets run up to `±23:59`.
- `-00:00` means UTC.
- `toJSON()` writes the moment in UTC, with `Z`.

| Property    | Value                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Accepts     | `2024-05-01T09:30:00Z`, `2024-05-01T11:30:00.250+02:00`, a `Temporal.Instant`                   |
| Rejects     | `2024-05-01T09:30:00` (no offset), `2024-05-01 09:30:00Z`, `2024-05-01T09:30:00+0200`, a `Date` |
| JSON Schema | `{ type: 'string', format: 'date-time', pattern: Instant.pattern.source }`, with an example     |
| Message     | `must be an RFC 3339 date-time with Z or an offset (was "2024-05-01T09:30:00")`                 |

```ts
import 'temporal-polyfill/global';
import { Instant } from '@horizon-republic/nominal-types/temporal';

const sent = new Instant('2024-05-01T11:30:00+02:00');

sent.value; // Temporal.Instant
sent.toJSON(); // '2024-05-01T09:30:00Z'
sent.equals(new Instant('2024-05-01T09:30:00Z')); // true
```

| Member     | Returns                                                      |
| ---------- | ------------------------------------------------------------ |
| `toDate()` | the same moment as a `Date`; digits below a millisecond drop |

| Static field      | Holds                           |
| ----------------- | ------------------------------- |
| `Instant.pattern` | the accepted text as a `RegExp` |

## PlainDate

A calendar date with no time and no zone, like `2024-05-01`.

| Property    | Value                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------- |
| Accepts     | `2024-02-29`, `0000-01-01`, `9999-12-31`, a `Temporal.PlainDate` in the ISO calendar     |
| Rejects     | `2023-02-29`, `1900-02-29`, `2024-5-1`, `20240501`, `2024-05-01T00:00:00`                |
| JSON Schema | `{ type: 'string', format: 'date', pattern: PlainDate.pattern.source }`, with an example |
| Message     | `must be a calendar date as YYYY-MM-DD (was "2023-02-29")`                               |

```ts
import 'temporal-polyfill/global';
import { PlainDate } from '@horizon-republic/nominal-types/temporal';

const due = new PlainDate('2024-02-29');

due.value.dayOfWeek; // 4
due.value.add({ days: 1 }).toString(); // '2024-03-01'
```

## PlainTime

A time of day with no date and no offset, like `09:30:00`.

The JSON Schema has no `format`, since the `time` format requires an offset.

| Property    | Value                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| Accepts     | `00:00:00`, `09:30:00.25`, `23:59:59.999999999`, a `Temporal.PlainTime`   |
| Rejects     | `09:30`, `9:30:00`, `24:00:00`, `23:59:60`, `09:30:00Z`, `09:30:00+01:00` |
| JSON Schema | `{ type: 'string', pattern: PlainTime.pattern.source }`, with an example  |
| Message     | `must be a time of day as hh:mm:ss (was "09:30")`                         |

```ts
import 'temporal-polyfill/global';
import { PlainTime } from '@horizon-republic/nominal-types/temporal';

const opens = new PlainTime('09:30:00');

opens.value.add({ minutes: 45 }).toString(); // '10:15:00'
```

## PlainDateTime

A date and a time of day with no offset and no zone, like `2024-05-01T09:30:00`. Text with an offset names a moment: use `Instant` for it.

The JSON Schema has no `format`, since the `date-time` format requires an offset.

| Property    | Value                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Accepts     | `2024-05-01T09:30:00`, `2024-02-29T12:00:00.5`, a `Temporal.PlainDateTime` in the ISO calendar  |
| Rejects     | `2024-05-01T09:30:00Z`, `2024-05-01T09:30:00+02:00`, `2024-05-01 09:30:00`, `2024-05-01T09:30`  |
| JSON Schema | `{ type: 'string', pattern: PlainDateTime.pattern.source }`, with an example                    |
| Message     | `must be a date and time as YYYY-MM-DDThh:mm:ss without an offset (was "2024-05-01T09:30:00Z")` |

```ts
import 'temporal-polyfill/global';
import { PlainDateTime } from '@horizon-republic/nominal-types/temporal';

const meeting = new PlainDateTime('2024-05-01T09:30:00');

meeting.value.toZonedDateTime('Europe/Kyiv').toInstant().toString(); // '2024-05-01T06:30:00Z'
```

## See also

- [How to use dates and times](../../guides/core/use-dates-and-times.md)
- [Database columns](../adapters/database-columns.md#dates-and-times)

[← Built-in types](README.md)
