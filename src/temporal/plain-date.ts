import type { NominalSchema, NominalType } from '../core/contracts.ts';
import { Nominal } from '../core/nominal.ts';
import { inOneLine } from '../core/same-value.ts';
import { asText, defineTextForm } from '../core/text-form.ts';
import { dateFields, fullDate, whole } from './grammar.ts';
import { noPrimitive, temporalRule } from './temporal-rule.ts';

const pattern = whole(fullDate);

/**
 * Internal: whether a Temporal date has the ISO 8601 calendar and a year the text form can carry.
 */
export const isIsoInRange = (value: Temporal.PlainDate | Temporal.PlainDateTime): boolean =>
  value.calendarId === 'iso8601' && value.year >= 0 && value.year <= 9999;

const PlainDateBase: NominalType<
  'nominal.PlainDate',
  NominalSchema<string | Temporal.PlainDate, Temporal.PlainDate>
> = Nominal(
  'nominal.PlainDate',
  temporalRule<Temporal.PlainDate>({
    typeName: 'nominal.PlainDate',
    tag: 'Temporal.PlainDate',
    pattern,
    description: 'a calendar date as YYYY-MM-DD',
    json: { format: 'date', examples: ['2024-05-01'] },
    accepts: (temporal, value): value is Temporal.PlainDate =>
      value instanceof temporal.PlainDate && isIsoInRange(value),
    build: (temporal, text) => new temporal.PlainDate(...dateFields(text)),
  }),
);

/**
 * A calendar date with no time and no time zone, held as a `Temporal.PlainDate`: a birthday, a
 * due date, a SQL `date`.
 *
 * @remarks
 * Text is an RFC 3339 §5.6 `full-date`, `2024-05-01`: four-digit year from 0000 to 9999, and a
 * day that exists in that month, so `2024-02-29` passes and `2023-02-29` does not. A
 * `Temporal.PlainDate` in the ISO 8601 calendar is taken as well.
 *
 * Temporal comes from the runtime: Node.js 26 has it; on older versions load
 * `temporal-polyfill/global` before the first value is built, or the constructor throws a
 * `TypeError` that says so.
 *
 * @example
 * ```ts
 * const due = new PlainDate('2024-02-29');
 * due.value.dayOfWeek; // 4
 * due.value.add({ days: 1 }).toString(); // '2024-03-01'
 * ```
 */
export class PlainDate extends PlainDateBase {
  /**
   * The whole text the type accepts.
   *
   * @remarks
   * The rule is built from it once, when the class is defined, so a subclass that changes the
   * pattern overrides `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * Whether the other value is the same date and belongs to this type, a type under it or the
   * type it is under.
   */
  public override equals(other: unknown): boolean {
    return inOneLine(this, other) && other instanceof PlainDate && this.value.equals(other.value);
  }

  /**
   * The date as `YYYY-MM-DD`.
   */
  public override toJSON(): string {
    return this.value.toString();
  }

  /**
   * The date as `toJSON()` writes it.
   */
  public override toString(): string {
    return this.value.toString();
  }

  /**
   * The text in a string; anywhere else a `TypeError`, since `<` on two dates would otherwise
   * compare text.
   */
  public override [Symbol.toPrimitive](hint: string): string {
    if (hint === 'string') {
      return this.toString();
    }

    throw noPrimitive(this, 'Temporal.PlainDate');
  }
}

defineTextForm(PlainDate, asText);
