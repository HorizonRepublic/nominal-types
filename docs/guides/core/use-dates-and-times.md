# How to use dates and times

This guide shows how to check dates and times with the four [Temporal](../../reference/glossary.md) types: `Instant`, `PlainDate`, `PlainTime` and `PlainDateTime`.

## Load Temporal

The types need `Temporal` from the runtime. Node.js 26 has it, so skip this step there.

On Node.js 22 and 24, install the polyfill:

```shell
npm install temporal-polyfill
```

Load it once, in the file your program starts from, before any other import that builds a value:

```ts
// main.ts
import 'temporal-polyfill/global';
```

Without it, building a value throws `TypeError: nominal.Instant needs Temporal, which this runtime lacks: import 'temporal-polyfill/global' before the first value is built`.

## Pick the type

| The value                                   | Type            | Example text           |
| ------------------------------------------- | --------------- | ---------------------- |
| a moment, such as when an order was paid    | `Instant`       | `2024-05-01T09:30:00Z` |
| a calendar date, such as a birthday         | `PlainDate`     | `2024-05-01`           |
| a time of day, such as an opening hour      | `PlainTime`     | `09:30:00`             |
| a date and time in no zone, a local meeting | `PlainDateTime` | `2024-05-01T09:30:00`  |

An `Instant` needs an offset in its text, such as `Z` or `+02:00`. The other three refuse one.

## Check a request body

Use the types as fields of `objectOf()`, like any other type:

```ts
import 'temporal-polyfill/global';
import { Email, objectOf } from '@horizon-republic/nominal-types';
import { Instant, PlainDate } from '@horizon-republic/nominal-types/temporal';

const ScheduleReminder = objectOf({
  customer: Email,
  sendAt: Instant,
  due: PlainDate,
});

const body: unknown = { customer: 'jane@example.com', sendAt: '2024-05-01 09:00', due: '2024-02-30' };

ScheduleReminder.parse(body);
// { ok: false, issues: [
//   { message: 'must be an RFC 3339 date-time with Z or an offset (was "2024-05-01 09:00")', path: ['sendAt'] },
//   { message: 'must be a calendar date as YYYY-MM-DD (was "2024-02-30")', path: ['due'] },
// ] }
```

A valid body gives instances. Their `toJSON()` writes the text back, so a response needs no extra step.

## Compare and calculate

Read the Temporal object from `.value` and use Temporal's methods. The `<` and `>` operators throw a `TypeError` on these types:

```ts
import 'temporal-polyfill/global';
import { Instant, PlainDate } from '@horizon-republic/nominal-types/temporal';

const earlier = new Instant('2024-05-01T09:30:00Z');
const later = new Instant('2024-05-01T12:00:00+02:00');

Temporal.Instant.compare(earlier.value, later.value); // -1
earlier.value.until(later.value).total('minutes'); // 30
new PlainDate('2024-05-01').value.add({ days: 30 }).toString(); // '2024-05-31'
```

`equals()` compares moments, so `new Instant('2024-05-01T11:30:00+02:00')` equals `new Instant('2024-05-01T09:30:00Z')`.

## Set a range

Make a [subtype](../../reference/glossary.md) with a rule on the Temporal value:

```ts
import 'temporal-polyfill/global';
import { satisfying } from '@horizon-republic/nominal-types';
import { PlainDate } from '@horizon-republic/nominal-types/temporal';

const isFrom1900 = (value: unknown): value is Temporal.PlainDate =>
  value instanceof Temporal.PlainDate && Temporal.PlainDate.compare(value, '1900-01-01') >= 0;

export class BirthDate extends PlainDate.subtype(
  'people.BirthDate',
  satisfying(isFrom1900, 'a date from 1900 on', {}),
) {}

new BirthDate('1990-07-15').value.year; // 1990
BirthDate.parse('1899-12-31'); // { ok: false, issues: [{ message: 'must be a date from 1900 on (was object)' }] }
```

Keep rules that depend on today, such as "in the past", out of the type. A value valid today would turn invalid later. Check them where the value is used.

## Read from text

Each type has a text form, so `fromString()` and `fromEnv()` read it:

```ts
import 'temporal-polyfill/global';
import { Nominal, objectOf } from '@horizon-republic/nominal-types';
import { PlainTime } from '@horizon-republic/nominal-types/temporal';

class Config extends Nominal('app.Config', objectOf({ BACKUP_AT: PlainTime }).fromEnv()) {}

new Config({ BACKUP_AT: '03:00:00' }).BACKUP_AT.value.hour; // 3
```

## Store in a database

The database adapters give each type a column: `timestamptz`, `date`, `time` and `timestamp`. Some drivers return a `Date` for these columns. [Database columns](../../reference/adapters/database-columns.md#dates-and-times) says which reads work and what to set.

## See also

- [Dates and times](../../reference/types/temporal.md): every rule and message
- [How to check a request body with objectOf()](check-an-object.md)
- [How to make a stricter type or a variant](build-on-a-type.md)

[← Guides](../README.md)
