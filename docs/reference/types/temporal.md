# Dates and times

[Built-in types](README.md) › Dates and times

These seven types come from their own [entry point](../glossary.md), `@horizon-republic/nominal-types/temporal`. `TimeZoneId` is a string type under `AnyString`. The others are roots, and their `value` is a [Temporal](../glossary.md) object.

| Type            | Holds                    | Text                                      | Use it for                                    |
| --------------- | ------------------------ | ----------------------------------------- | --------------------------------------------- |
| `Instant`       | `Temporal.Instant`       | `2024-05-01T09:30:00Z`                    | a moment: when an order was paid              |
| `PlainDate`     | `Temporal.PlainDate`     | `2024-05-01`                              | a calendar date: a birthday, a due date       |
| `PlainTime`     | `Temporal.PlainTime`     | `09:30:00`                                | a time of day: an opening hour                |
| `PlainDateTime` | `Temporal.PlainDateTime` | `2024-05-01T09:30:00`                     | a date and time in no zone: a local meeting   |
| `ZonedDateTime` | `Temporal.ZonedDateTime` | `2024-05-01T09:30:00+02:00[Europe/Paris]` | a date and time in a time zone: a flight      |
| `Duration`      | `Temporal.Duration`      | `P1DT12H`                                 | a length of time: a timeout, a billing period |
| `TimeZoneId`    | a string                 | `Europe/Paris`                            | a time zone: where a user lives               |

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

## Common to the dates and times

The text of `Instant`, `PlainDate`, `PlainTime`, `PlainDateTime` and `ZonedDateTime` must follow [RFC 3339](../glossary.md), the date and time format of the internet:

- `T` and `Z` are upper case. A space in place of `T` is refused.
- Years run from `0000` to `9999`, with four digits.
- The day must exist in its month: `2024-02-29` passes, `2023-02-29` and `2024-04-31` don't.
- `Instant` requires seconds: `2024-05-01T09:30Z` is refused. `PlainTime` and `PlainDateTime` take a time without them, `09:30`, as HTML `time` and `datetime-local` inputs send it.
- A fraction of a second has 1 to 9 digits after a dot. A comma is refused.
- The leap second `:60` is refused.
- Week dates (`2021-W53-1`), day-of-year dates (`2009-130`) and the compact form (`20240501T093000Z`) are refused.
- A zone name in brackets (`[Europe/Paris]`) is refused, except by `ZonedDateTime`, which requires one.

Other rules, for every type here but `TimeZoneId`:

- Each type also takes a Temporal object of its own kind, such as a `Temporal.Instant`.
- `toJSON()` and `toString()` give the text Temporal writes.
- `equals()` compares the moment, date, time or length, not the text.
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

| Property    | Value                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| Accepts     | `00:00:00`, `09:30`, `09:30:00.25`, `23:59:59.999999999`, a `Temporal.PlainTime` |
| Rejects     | `9:30`, `09:3`, `24:00`, `23:59:60`, `09:30Z`, `09:30:00+01:00`                  |
| JSON Schema | `{ type: 'string', pattern: PlainTime.pattern.source }`, with an example         |
| Message     | `must be a time of day as hh:mm or hh:mm:ss (was "9:30")`                        |

```ts
import 'temporal-polyfill/global';
import { PlainTime } from '@horizon-republic/nominal-types/temporal';

const opens = new PlainTime('09:30');

opens.toJSON(); // '09:30:00'
opens.value.add({ minutes: 45 }).toString(); // '10:15:00'
```

## PlainDateTime

A date and a time of day with no offset and no zone, like `2024-05-01T09:30:00`. Text with an offset names a moment: use `Instant` for it.

The JSON Schema has no `format`, since the `date-time` format requires an offset.

| Property    | Value                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Accepts     | `2024-05-01T09:30:00`, `2024-05-01T09:30`, `2024-02-29T12:00:00.5`, a `Temporal.PlainDateTime` in the ISO calendar  |
| Rejects     | `2024-05-01T09:30:00Z`, `2024-05-01T09:30:00+02:00`, `2024-05-01 09:30:00`, `2024-05-01T09`                         |
| JSON Schema | `{ type: 'string', pattern: PlainDateTime.pattern.source }`, with an example                                        |
| Message     | `must be a date and time as YYYY-MM-DDThh:mm or YYYY-MM-DDThh:mm:ss without an offset (was "2024-05-01T09:30:00Z")` |

```ts
import 'temporal-polyfill/global';
import { PlainDateTime } from '@horizon-republic/nominal-types/temporal';

const meeting = new PlainDateTime('2024-05-01T09:30:00');

meeting.value.toZonedDateTime('Europe/Kyiv').toInstant().toString(); // '2024-05-01T06:30:00Z'
```

## ZonedDateTime

A date and time in a named time zone, like `2024-05-01T09:30:00+02:00[Europe/Paris]`. The text follows [RFC 9557](../glossary.md): the text of an `Instant` with a numeric offset, then the zone name in brackets.

- The offset is required. It must be the one the zone has at that moment: in Paris, `+02:00` passes in May and `+01:00` doesn't.
- A time that [daylight saving time](../glossary.md) skips is refused, whatever its offset. `2024-03-31T02:30` doesn't exist in Paris.
- A time that happens twice, when the clocks go back, is told apart by its offset.
- `Z` and `-00:00` are refused, since they don't state the local offset.
- The zone is an [IANA time zone](../glossary.md) name the runtime knows, in any case. An offset in brackets, such as `[+02:00]`, is refused.
- Other parts in brackets, such as `[u-ca=iso8601]`, and the flag `!` are refused.
- The moment must also fit an `Instant`: from year `0000` to `9999` in UTC.
- `toJSON()` writes the zone name as the runtime does: `[europe/paris]` becomes `[Europe/Paris]`.

The JSON Schema checks the shape only. Whether the zone exists and the offset fits it, only the type checks, with the time zone data of the runtime.

| Property    | Value                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accepts     | `2024-05-01T09:30:00+02:00[Europe/Paris]`, `2024-10-27T02:30:00+01:00[Europe/Paris]`, a `Temporal.ZonedDateTime` in a named zone                                |
| Rejects     | `2024-05-01T09:30:00+01:00[Europe/Paris]`, `2024-05-01T09:30:00Z[Europe/Paris]`, `2024-05-01T09:30:00+02:00`, `2024-05-01T09:30:00+02:00[Mars/Olympus]`         |
| JSON Schema | `{ type: 'string', pattern: ZonedDateTime.pattern.source }`, with an example                                                                                    |
| Message     | `must be an RFC 9557 date-time as YYYY-MM-DDThh:mm:ss±hh:mm[Area/City], with the offset its time zone has then (was "2024-05-01T09:30:00+01:00[Europe/Paris]")` |

```ts
import 'temporal-polyfill/global';
import { ZonedDateTime } from '@horizon-republic/nominal-types/temporal';

const meeting = new ZonedDateTime('2024-05-01T09:30:00+02:00[Europe/Paris]');

meeting.timeZone.value; // 'Europe/Paris'
meeting.toInstant().toJSON(); // '2024-05-01T07:30:00Z'
meeting.value.add({ months: 6 }).toString(); // '2024-11-01T09:30:00+01:00[Europe/Paris]'
ZonedDateTime.parse('2024-03-31T02:30:00+01:00[Europe/Paris]').ok; // false
```

| Member        | Returns                         |
| ------------- | ------------------------------- |
| `timeZone`    | the zone as a `TimeZoneId`      |
| `toInstant()` | the same moment as an `Instant` |

| Static field            | Holds                                        |
| ----------------------- | -------------------------------------------- |
| `ZonedDateTime.pattern` | the shape of the accepted text as a `RegExp` |

## Duration

A length of time, like `P1DT12H` for one day and twelve hours. The text is an [ISO 8601 duration](../glossary.md), as RFC 3339 writes it:

- `P`, then years `Y`, months `M` and days `D`, in that order.
- Then `T`, then hours `H`, minutes `M` and seconds `S`, in that order.
- Or weeks alone, such as `P2W`. Weeks don't mix with other units.
- Units may be left out, but at least one is there: `P1Y3D` and `PT1H5S` pass, `P` and `PT` don't.
- Letters are upper case. Each number has at most nine digits.
- Only the seconds take a fraction, with 1 to 9 digits after a dot: `PT0.5S`. A comma is refused.
- A sign is refused, so `-P1D` doesn't pass.

`equals()` compares unit by unit. `P1D` doesn't equal `PT24H`, since a day can last 23 or 25 hours. `PT90M` doesn't equal `PT1H30M`.

The JSON Schema has no `format`. The `duration` format allows no fractions, so a validator such as Ajv would refuse `PT0.5S`.

| Property    | Value                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| Accepts     | `P1Y2M3DT4H5M6S`, `P2W`, `PT36H`, `PT0.5S`, `P0D`, a `Temporal.Duration` with no sign |
| Rejects     | `-P1D`, `P1W2D`, `PT1.5H`, `PT1,5S`, `P1D2H` (no `T`), `p1d`, `P`                     |
| JSON Schema | `{ type: 'string', pattern: Duration.pattern.source }`, with an example               |
| Message     | `must be an ISO 8601 duration such as P1DT12H, PT0.5S or P2W (was "-P1D")`            |

```ts
import 'temporal-polyfill/global';
import { Duration } from '@horizon-republic/nominal-types/temporal';

const timeout = new Duration('PT1M30S');

timeout.value.total('seconds'); // 90
new Duration('P1M').value.total({ unit: 'days', relativeTo: '2024-02-01' }); // 29
new Duration('P1D').equals(new Duration('PT24H')); // false
```

| Static field       | Holds                           |
| ------------------ | ------------------------------- |
| `Duration.pattern` | the accepted text as a `RegExp` |

## TimeZoneId

The name of an [IANA time zone](../glossary.md), like `Europe/Paris` or `UTC`. It is a string type under `AnyString`, and it [implies](string.md#implied-types) `NonEmptyString` and `NonBlankString`.

- The name must be one the runtime knows.
- Case is free and kept as given.
- Old names are accepted, such as `US/Pacific`.
- `canonical()` gives the name the runtime holds as the main one: `America/Los_Angeles` for `US/Pacific`.
- `equals()` compares `canonical()`, so `utc` equals `Etc/UTC`.
- An offset such as `+02:00` is refused. An offset is not a zone, since it doesn't change with daylight saving time.

The JSON Schema checks the shape of a name only. Whether the zone exists, only the type checks.

The list of zones and their main names come from the time zone data of the runtime, which can differ between Node.js versions. Node.js 24 gives `Europe/Kiev` for `Europe/Kyiv` and `Asia/Calcutta` for `Asia/Kolkata`. Store the name as it came, and compare with `equals()`.

| Property    | Value                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------- |
| Accepts     | `Europe/Paris`, `europe/paris`, `UTC`, `America/Argentina/Buenos_Aires`, `US/Pacific`, `Etc/GMT+5` |
| Rejects     | `+02:00`, `Z`, `Mars/Olympus`, `Europe//Paris`, `Europe/Paris ` (with a space)                     |
| JSON Schema | `{ type: 'string', pattern: TimeZoneId.pattern.source }`, with an example                          |
| Message     | `must be an IANA time zone name the runtime knows, such as Europe/Paris (was "+02:00")`            |

```ts
import 'temporal-polyfill/global';
import { TimeZoneId } from '@horizon-republic/nominal-types/temporal';

const zone = new TimeZoneId('europe/paris');

zone.value; // 'europe/paris'
zone.canonical().value; // 'Europe/Paris'
new TimeZoneId('US/Pacific').canonical().value; // 'America/Los_Angeles'
zone.equals(new TimeZoneId('Europe/Paris')); // true
```

| Member        | Returns                                                         |
| ------------- | --------------------------------------------------------------- |
| `canonical()` | the main name of the zone, in the runtime's case, as a new copy |

| Static field         | Holds                                       |
| -------------------- | ------------------------------------------- |
| `TimeZoneId.pattern` | the shape of an accepted name as a `RegExp` |

## See also

- [How to use dates and times](../../guides/core/use-dates-and-times.md)
- [Database columns](../adapters/database-columns.md#dates-and-times)

[← Built-in types](README.md)
