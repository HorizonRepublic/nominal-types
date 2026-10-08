# How to use dates and times

This guide shows how to check dates, times, time zones and lengths of time with the [Temporal](../../reference/glossary.md) types: `Instant`, `PlainDate`, `PlainTime`, `PlainDateTime`, `ZonedDateTime`, `Duration` and `TimeZoneId`.

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

| The value                                   | Type            | Example text                              |
| ------------------------------------------- | --------------- | ----------------------------------------- |
| a moment, such as when an order was paid    | `Instant`       | `2024-05-01T09:30:00Z`                    |
| a calendar date, such as a birthday         | `PlainDate`     | `2024-05-01`                              |
| a time of day, such as an opening hour      | `PlainTime`     | `09:30:00`                                |
| a date and time in no zone, a local meeting | `PlainDateTime` | `2024-05-01T09:30:00`                     |
| a date and time in a time zone, a flight    | `ZonedDateTime` | `2024-05-01T09:30:00+02:00[Europe/Paris]` |
| a length of time, such as a timeout         | `Duration`      | `PT1M30S`                                 |
| a time zone, such as a user's               | `TimeZoneId`    | `Europe/Paris`                            |

An `Instant` needs an offset in its text, such as `Z` or `+02:00`. A `ZonedDateTime` needs an offset and a zone name. `PlainDate`, `PlainTime` and `PlainDateTime` refuse an offset.

## Check a request body

Use the types as fields of `n.object()`, like any other type:

```ts
import 'temporal-polyfill/global';
import { Email, n } from '@horizon-republic/nominal-types';
import { Instant, PlainDate } from '@horizon-republic/nominal-types/temporal';

const ScheduleReminder = n.object({
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
import { n } from '@horizon-republic/nominal-types';
import { PlainDate } from '@horizon-republic/nominal-types/temporal';

const isFrom1900 = (value: unknown): value is Temporal.PlainDate =>
  value instanceof Temporal.PlainDate && Temporal.PlainDate.compare(value, '1900-01-01') >= 0;

export class BirthDate extends PlainDate.subtype(
  'people.BirthDate',
  n.satisfying(isFrom1900, 'a date from 1900 on', {}),
) {}

new BirthDate('1990-07-15').value.year; // 1990
BirthDate.parse('1899-12-31'); // { ok: false, issues: [{ message: 'must be a date from 1900 on (was "1899-12-31")' }] }
```

Keep rules that depend on today, such as "in the past", out of the type. A value valid today would turn invalid later. Check them where the value is used.

## Read from text

Each type has a text form, so `fromString()` and `fromEnv()` read it:

```ts
import 'temporal-polyfill/global';
import { n, Nominal } from '@horizon-republic/nominal-types';
import { PlainTime } from '@horizon-republic/nominal-types/temporal';

class Config extends Nominal('app.Config', n.object({ BACKUP_AT: PlainTime }).fromEnv()) {}

new Config({ BACKUP_AT: '03:00:00' }).BACKUP_AT.value.hour; // 3
```

## Read an HTML form

An HTML `time` input sends `09:30`, and a `datetime-local` input sends `2024-05-01T09:30`. `PlainTime` and `PlainDateTime` take this text without seconds:

```ts
import 'temporal-polyfill/global';
import { n } from '@horizon-republic/nominal-types';
import { PlainDate, PlainDateTime, PlainTime } from '@horizon-republic/nominal-types/temporal';

const Booking = n.object({ day: PlainDate, opensAt: PlainTime, startsAt: PlainDateTime });

const form: unknown = { day: '2024-05-01', opensAt: '09:30', startsAt: '2024-05-01T09:30' };
const result = Booking.parse(form);

if (result.ok) {
  result.value.opensAt.toJSON(); // '09:30:00'
  result.value.startsAt.toJSON(); // '2024-05-01T09:30:00'
}
```

An `Instant` still needs seconds and an offset. A form has no input that sends them.

## Keep the time zone

An `Instant` is a moment and forgets where it was written. When the zone matters, use a `ZonedDateTime`. Adding six months then keeps the local time across a change of [daylight saving time](../../reference/glossary.md):

```ts
import 'temporal-polyfill/global';
import { ZonedDateTime } from '@horizon-republic/nominal-types/temporal';

const departure = new ZonedDateTime('2024-05-01T09:30:00+02:00[Europe/Paris]');

departure.value.add({ months: 6 }).toString(); // '2024-11-01T09:30:00+01:00[Europe/Paris]'
departure.toInstant().toJSON(); // '2024-05-01T07:30:00Z'
```

The offset in the text must be the one the zone has at that time. A client that sends `+01:00` for Paris in May gets an error rather than a moment one hour off.

To store a user's zone on its own, use `TimeZoneId`. It takes the names the runtime knows, in any case:

```ts
import 'temporal-polyfill/global';
import { TimeZoneId } from '@horizon-republic/nominal-types/temporal';

const zone = new TimeZoneId('europe/paris');

zone.canonical().value; // 'Europe/Paris'
Temporal.Now.zonedDateTimeISO(zone.value).timeZoneId; // 'Europe/Paris'
TimeZoneId.parse('+02:00').ok; // false
```

## Check a length of time

A `Duration` reads ISO 8601 text such as `PT30S` or `P1M`. Read its length in one unit with `total()`:

```ts
import 'temporal-polyfill/global';
import { n } from '@horizon-republic/nominal-types';
import { Duration } from '@horizon-republic/nominal-types/temporal';

const Settings = n.object({ timeout: Duration, trial: Duration });

const body: unknown = { timeout: 'PT1M30S', trial: 'P14D' };
const result = Settings.parse(body);

if (result.ok) {
  result.value.timeout.value.total('milliseconds'); // 90000
  result.value.trial.value.total('days'); // 14
}
```

A month or a year has no fixed length. `total()` needs a start date for them: `new Duration('P1M').value.total({ unit: 'days', relativeTo: '2024-02-01' })` gives `29`.

## Store in a database

The database adapters give each type a column: `timestamptz`, `date`, `time` and `timestamp`, and `text` for `ZonedDateTime`, `Duration` and `TimeZoneId`. Some drivers return a `Date` for these columns. [Database columns](../../reference/adapters/database-columns.md#dates-and-times) says which reads work and what to set.

## See also

- [Dates and times](../../reference/types/temporal.md): every rule and message
- [How to check a request body with n.object()](check-an-object.md)
- [How to make a stricter type or a variant](build-on-a-type.md)

[← Guides](../README.md)
