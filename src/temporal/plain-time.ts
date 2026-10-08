import type { NominalSchema, NominalType } from '../core/contracts.ts';
import { Nominal } from '../core/nominal.ts';
import { inOneLine } from '../core/same-value.ts';
import type { StandardOf } from '../core/standard-schema.ts';
import { asText, defineTextForm } from '../core/text-form.ts';
import { timeFields, wallTime, whole } from './grammar.ts';
import { noPrimitive, temporalRule } from './temporal-rule.ts';

const pattern = whole(wallTime);

const PlainTimeBase: NominalType<
  'nominal.PlainTime',
  NominalSchema<string | Temporal.PlainTime, Temporal.PlainTime>
> = Nominal(
  'nominal.PlainTime',
  temporalRule<Temporal.PlainTime>({
    typeName: 'nominal.PlainTime',
    tag: 'Temporal.PlainTime',
    pattern,
    description: 'a time of day as hh:mm or hh:mm:ss',
    json: { examples: ['09:30:00'] },
    accepts: (temporal, value): value is Temporal.PlainTime => value instanceof temporal.PlainTime,
    build: (temporal, text) => new temporal.PlainTime(...timeFields(text, 0)),
  }),
);

/**
 * A wall-clock time with no date and no offset, held as a `Temporal.PlainTime`: an opening hour,
 * an alarm, a SQL `time`.
 *
 * @remarks
 * Text is an RFC 3339 §5.6 `partial-time`, `09:30:00` or `09:30:00.250`, or `09:30` without the
 * seconds, as an HTML `time` input sends it: a fraction of at most nine digits, no offset and no
 * leap second `:60`. A `Temporal.PlainTime` is
 * taken as well. The JSON Schema carries a `pattern` and no `format`, since the `time` format
 * requires an offset.
 *
 * Temporal comes from the runtime: Node.js 26 has it; on older versions load
 * `temporal-polyfill/global` before the first value is built, or the constructor throws a
 * `TypeError` that says so.
 *
 * @example
 * ```ts
 * const opens = new PlainTime('09:30:00');
 * opens.value.hour; // 9
 * opens.value.add({ minutes: 45 }).toString(); // '10:15:00'
 * ```
 */
export class PlainTime extends PlainTimeBase {
  declare public static readonly '~standard': StandardOf<typeof PlainTime>;

  /**
   * The whole text the type accepts.
   *
   * @remarks
   * The rule is built from it once, when the class is defined, so a subclass that changes the
   * pattern overrides `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * Whether the other value is the same time and belongs to this type, a type under it or the
   * type it is under.
   */
  public override equals(other: unknown): boolean {
    return inOneLine(this, other) && other instanceof PlainTime && this.value.equals(other.value);
  }

  /**
   * The time as `hh:mm:ss`, with a fraction when there is one.
   */
  public override toJSON(): string {
    return this.value.toString();
  }

  /**
   * The time as `toJSON()` writes it.
   */
  public override toString(): string {
    return this.value.toString();
  }

  /**
   * The text in a string; anywhere else a `TypeError`, since `<` on two times would otherwise
   * compare text.
   */
  public override [Symbol.toPrimitive](hint: string): string {
    if (hint === 'string') {
      return this.toString();
    }

    throw noPrimitive(this, 'Temporal.PlainTime');
  }
}

defineTextForm(PlainTime, asText);
