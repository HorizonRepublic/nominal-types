import type { NominalSchema, NominalType } from '../core/contracts.ts';
import { Nominal } from '../core/nominal.ts';
import { inOneLine } from '../core/same-value.ts';
import { asText, defineTextForm } from '../core/text-form.ts';
import { dateFields, fullDate, partialTime, timeFields, whole } from './grammar.ts';
import { isIsoInRange } from './plain-date.ts';
import { noPrimitive, temporalRule } from './temporal-rule.ts';

const pattern = whole(`${fullDate}T${partialTime}`);

const PlainDateTimeBase: NominalType<
  'nominal.PlainDateTime',
  NominalSchema<string | Temporal.PlainDateTime, Temporal.PlainDateTime>
> = Nominal(
  'nominal.PlainDateTime',
  temporalRule<Temporal.PlainDateTime>({
    typeName: 'nominal.PlainDateTime',
    tag: 'Temporal.PlainDateTime',
    pattern,
    description: 'a date and time as YYYY-MM-DDThh:mm:ss without an offset',
    json: { examples: ['2024-05-01T09:30:00'] },
    accepts: (temporal, value): value is Temporal.PlainDateTime =>
      value instanceof temporal.PlainDateTime && isIsoInRange(value),
    build: (temporal, text) =>
      new temporal.PlainDateTime(...dateFields(text), ...timeFields(text, 11)),
  }),
);

/**
 * A date and wall-clock time with no offset and no time zone, held as a
 * `Temporal.PlainDateTime`: a meeting in whatever zone it happens in, a SQL `timestamp` without
 * time zone.
 *
 * @remarks
 * Text is an RFC 3339 §5.6 `full-date`, `T` and `partial-time`, `2024-05-01T09:30:00`, with the
 * limits of `PlainDate` and `PlainTime`. An offset or `Z` is refused: text that names a moment
 * belongs in an `Instant`. A `Temporal.PlainDateTime` in the ISO 8601 calendar is taken as well.
 * The JSON Schema carries a `pattern` and no `format`, since `date-time` requires an offset.
 *
 * Temporal comes from the runtime: Node.js 26 has it; on older versions load
 * `temporal-polyfill/global` before the first value is built, or the constructor throws a
 * `TypeError` that says so.
 *
 * @example
 * ```ts
 * const meeting = new PlainDateTime('2024-05-01T09:30:00');
 * meeting.value.toPlainDate().toString(); // '2024-05-01'
 * meeting.value.toZonedDateTime('Europe/Kyiv').toInstant().toString(); // '2024-05-01T06:30:00Z'
 * ```
 */
export class PlainDateTime extends PlainDateTimeBase {
  /**
   * The whole text the type accepts.
   *
   * @remarks
   * The rule is built from it once, when the class is defined, so a subclass that changes the
   * pattern overrides `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * Whether the other value is the same date and time and belongs to this type, a type under it
   * or the type it is under.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) && other instanceof PlainDateTime && this.value.equals(other.value)
    );
  }

  /**
   * The date and time as `YYYY-MM-DDThh:mm:ss`, with a fraction when there is one.
   */
  public override toJSON(): string {
    return this.value.toString();
  }

  /**
   * The date and time as `toJSON()` writes them.
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

    throw noPrimitive(this, 'Temporal.PlainDateTime');
  }
}

defineTextForm(PlainDateTime, asText);
