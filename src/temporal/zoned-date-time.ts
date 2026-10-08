import type { NominalSchema, NominalType } from '../core/contracts.ts';
import { Nominal } from '../core/nominal.ts';
import { inOneLine } from '../core/same-value.ts';
import type { StandardOf } from '../core/standard-schema.ts';
import { asText, defineTextForm } from '../core/text-form.ts';
import {
  fullDate,
  localOffset,
  offsetSeconds,
  partialTime,
  timeZoneName,
  whole,
} from './grammar.ts';
import { epochNanosecondsOf, Instant, isInstantInRange } from './instant.ts';
import { noPrimitive, temporalRule } from './temporal-rule.ts';
import type { TemporalApi } from './temporal-rule.ts';
import { TimeZoneId } from './time-zone-id.ts';

const pattern = whole(`${fullDate}T${partialTime}${localOffset}\\[${timeZoneName}\\]`);
const zoneName = whole(timeZoneName);

// The moment the text names is built first and the zone's offset at that moment compared with the
// one written. Where they differ, Temporal decides: it refuses a mismatch, and for a zone whose
// offset had seconds, as local mean time did before 1900, it compares the offset rounded to
// minutes, which is what its `toString()` writes.
const build = (temporal: TemporalApi, text: string): Temporal.ZonedDateTime | undefined => {
  const bracket = text.indexOf('[');
  const dateTime = text.slice(0, bracket);
  let value: Temporal.ZonedDateTime;

  try {
    value = new temporal.ZonedDateTime(epochNanosecondsOf(dateTime), text.slice(bracket + 1, -1));

    if (value.offsetNanoseconds !== offsetSeconds(dateTime) * 1e9) {
      value = temporal.ZonedDateTime.from(text, { offset: 'reject' });
    }
  } catch {
    return undefined;
  }

  return isInstantInRange(value) ? value : undefined;
};

const ZonedDateTimeBase: NominalType<
  'nominal.ZonedDateTime',
  NominalSchema<string | Temporal.ZonedDateTime, Temporal.ZonedDateTime>
> = Nominal(
  'nominal.ZonedDateTime',
  temporalRule<Temporal.ZonedDateTime>({
    typeName: 'nominal.ZonedDateTime',
    tag: 'Temporal.ZonedDateTime',
    pattern,
    description:
      'an RFC 9557 date-time as YYYY-MM-DDThh:mm:ss±hh:mm[Area/City], with the offset its time zone has then',
    json: { examples: ['2024-05-01T09:30:00+02:00[Europe/Paris]'] },
    accepts: (temporal, value): value is Temporal.ZonedDateTime =>
      value instanceof temporal.ZonedDateTime &&
      value.calendarId === 'iso8601' &&
      value.year >= 0 &&
      value.year <= 9999 &&
      isInstantInRange(value) &&
      zoneName.test(value.timeZoneId),
    build,
  }),
);

/**
 * A date and time in a named time zone, held as a `Temporal.ZonedDateTime`: a meeting in Paris
 * that moves with daylight saving time, a flight that leaves at local time.
 *
 * @remarks
 * Text is RFC 9557: an RFC 3339 §5.6 `date-time` with a numeric offset, then the IANA zone name in
 * brackets, `2024-05-01T09:30:00+02:00[Europe/Paris]`. The offset must be the one the zone has at
 * that moment, so a time that daylight saving time skips is refused, and a repeated hour is told
 * apart by its offset. `Z` and `-00:00` are refused, since they leave the local offset unknown;
 * so are offset zones such as `[+02:00]`, other annotations such as `[u-ca=iso8601]`, and the
 * critical flag `[!Europe/Paris]`. The date, time and fraction follow `Instant`, and the moment
 * must also fit an `Instant`. A `Temporal.ZonedDateTime` in a named zone and the ISO 8601 calendar
 * is taken as well.
 *
 * The zone name and the offset are checked with the runtime's time zone data, so the JSON Schema
 * `pattern` checks the shape only. Temporal comes from the runtime: Node.js 26 has it; on older
 * versions load `temporal-polyfill/global` before the first value is built, or the constructor
 * throws a `TypeError` that says so.
 *
 * @example
 * ```ts
 * const meeting = new ZonedDateTime('2024-05-01T09:30:00+02:00[Europe/Paris]');
 * meeting.timeZone.value; // 'Europe/Paris'
 * meeting.toInstant().toJSON(); // '2024-05-01T07:30:00Z'
 * meeting.value.add({ months: 6 }).toString(); // '2024-11-01T09:30:00+01:00[Europe/Paris]'
 * ```
 */
export class ZonedDateTime extends ZonedDateTimeBase {
  declare public static readonly '~standard': StandardOf<typeof ZonedDateTime>;

  /**
   * The whole text the type accepts, apart from the checks of the zone name and the offset.
   *
   * @remarks
   * The rule is built from it once, when the class is defined, so a subclass that changes the
   * pattern overrides `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The time zone, as the runtime writes its name.
   */
  public get timeZone(): TimeZoneId {
    return new TimeZoneId(this.value.timeZoneId);
  }

  /**
   * The moment on the global timeline, without the zone.
   */
  public toInstant(): Instant {
    return new Instant(this.value.toInstant());
  }

  /**
   * Whether the other value is the same moment in the same zone and belongs to this type, a type
   * under it or the type it is under.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) && other instanceof ZonedDateTime && this.value.equals(other.value)
    );
  }

  /**
   * The date, time, offset and zone, as `2024-05-01T09:30:00+02:00[Europe/Paris]`.
   */
  public override toJSON(): string {
    return this.value.toString();
  }

  /**
   * The text `toJSON()` writes.
   */
  public override toString(): string {
    return this.value.toString();
  }

  /**
   * The text in a string; anywhere else a `TypeError`, since `<` on two values would otherwise
   * compare text.
   */
  public override [Symbol.toPrimitive](hint: string): string {
    if (hint === 'string') {
      return this.toString();
    }

    throw noPrimitive(this, 'Temporal.ZonedDateTime');
  }
}

defineTextForm(ZonedDateTime, asText);
