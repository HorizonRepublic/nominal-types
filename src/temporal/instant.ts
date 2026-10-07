import type { NominalSchema, NominalType } from '../core/contracts.ts';
import { Nominal } from '../core/nominal.ts';
import { inOneLine } from '../core/same-value.ts';
import { asText, defineTextForm } from '../core/text-form.ts';
import {
  dateFields,
  epochDays,
  fullDate,
  offsetSeconds,
  partialTime,
  timeFields,
  timeOffset,
  whole,
} from './grammar.ts';
import { noPrimitive, temporalRule } from './temporal-rule.ts';
import type { TemporalApi } from './temporal-rule.ts';

const pattern = whole(`${fullDate}T${partialTime}${timeOffset}`);

// 0000-01-01T00:00:00Z and 9999-12-31T23:59:59.999Z, the instants whose UTC text stays in range.
const earliest = -62_167_219_200_000;
const latest = 253_402_300_799_999;

// Building from epoch nanoseconds skips a second parse of text the pattern has already checked.
const build = (temporal: TemporalApi, text: string): Temporal.Instant => {
  const [year, month, day] = dateFields(text);
  const [hour, minute, second, milli, micro, nano] = timeFields(text, 11);
  const seconds =
    epochDays(year, month, day) * 86_400 + hour * 3600 + minute * 60 + second - offsetSeconds(text);

  return temporal.Instant.fromEpochNanoseconds(
    BigInt(seconds * 1000 + milli) * 1_000_000n + BigInt(micro * 1000 + nano),
  );
};

const InstantBase: NominalType<
  'nominal.Instant',
  NominalSchema<string | Temporal.Instant, Temporal.Instant>
> = Nominal(
  'nominal.Instant',
  temporalRule<Temporal.Instant>({
    typeName: 'nominal.Instant',
    tag: 'Temporal.Instant',
    pattern,
    description: 'an RFC 3339 date-time with Z or an offset',
    json: { format: 'date-time', examples: ['2024-05-01T09:30:00Z'] },
    accepts: (temporal, value): value is Temporal.Instant =>
      value instanceof temporal.Instant &&
      value.epochMilliseconds >= earliest &&
      value.epochMilliseconds <= latest,
    build,
  }),
);

/**
 * A moment on the global timeline, held as a `Temporal.Instant`: what a log line, an event or a
 * `timestamptz` column records.
 *
 * @remarks
 * Text is an RFC 3339 §5.6 `date-time`: `2024-05-01T09:30:00Z` or `2024-05-01T11:30:00+02:00`.
 * The offset is required, `T` and `Z` are upper case, the year runs from 0000 to 9999, the day
 * must exist, seconds are required and a fraction has at most nine digits. The leap second `:60`
 * is refused, since Temporal would hold `:59` instead. A `Temporal.Instant` is taken as well.
 *
 * Temporal comes from the runtime: Node.js 26 has it; on older versions load
 * `temporal-polyfill/global` before the first value is built, or the constructor throws a
 * `TypeError` that says so.
 *
 * @example
 * ```ts
 * const sent = new Instant('2024-05-01T11:30:00+02:00');
 * sent.toJSON(); // '2024-05-01T09:30:00Z'
 * Temporal.Instant.compare(sent.value, new Instant('2024-05-01T10:00:00Z').value); // -1
 * ```
 */
export class Instant extends InstantBase {
  /**
   * The whole text the type accepts.
   *
   * @remarks
   * The rule is built from it once, when the class is defined, so a subclass that changes the
   * pattern overrides `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The same moment as a `Date`, for APIs that take one; anything below a millisecond is dropped.
   */
  public toDate(): Date {
    return new Date(this.value.epochMilliseconds);
  }

  /**
   * Whether the other value is the same moment, whatever offset each was written with, and belongs
   * to this type, a type under it or the type it is under.
   */
  public override equals(other: unknown): boolean {
    return inOneLine(this, other) && other instanceof Instant && this.value.equals(other.value);
  }

  /**
   * The moment in UTC, as `2024-05-01T09:30:00Z`.
   */
  public override toJSON(): string {
    return this.value.toString();
  }

  /**
   * The moment in UTC, as `toJSON()` writes it.
   */
  public override toString(): string {
    return this.value.toString();
  }

  /**
   * The text in a string; anywhere else a `TypeError`, since `<` on two instants would otherwise
   * compare text.
   */
  public override [Symbol.toPrimitive](hint: string): string {
    if (hint === 'string') {
      return this.toString();
    }

    throw noPrimitive(this, 'Temporal.Instant');
  }
}

defineTextForm(Instant, asText);
