import type { NominalSchema, NominalType } from '../core/contracts.ts';
import { Nominal } from '../core/nominal.ts';
import { inOneLine } from '../core/same-value.ts';
import type { StandardOf } from '../core/standard-schema.ts';
import { asText, defineTextForm } from '../core/text-form.ts';
import { whole } from './grammar.ts';
import { noPrimitive, temporalRule } from './temporal-rule.ts';
import type { TemporalApi } from './temporal-rule.ts';

const number = '\\d{1,9}';
const seconds = `${number}(?:\\.\\d{1,9})?S`;
const date = `${number}Y(?:${number}M)?(?:${number}D)?|${number}M(?:${number}D)?|${number}D`;
const time = `T(?:${number}H(?:${number}M)?(?:${seconds})?|${number}M(?:${seconds})?|${seconds})`;
const pattern = whole(`P(?:${number}W|(?:${date})(?:${time})?|${time})`);

const fields = [
  'years',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds',
  'microseconds',
  'nanoseconds',
] as const;

type Fields = [number, number, number, number, number, number, number, number, number, number];

// The units in the order of the fields, the time units after the four date units.
const dateUnits = 'YMWD';
const timeUnits = '____HMS';

// The pattern has checked the text, so each number is followed by its unit letter.
const build = (temporal: TemporalApi, text: string): Temporal.Duration => {
  const values: Fields = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let units = dateUnits;
  let start = 1;

  for (let at = 1; at < text.length; at += 1) {
    const char = text.charAt(at);

    if (char === 'T') {
      units = timeUnits;
      start = at + 1;
    } else if (char === '.') {
      const fraction = `${text.slice(at + 1, -1)}00000000`;

      values[7] = Number(fraction.slice(0, 3));
      values[8] = Number(fraction.slice(3, 6));
      values[9] = Number(fraction.slice(6, 9));
      values[6] = Number(text.slice(start, at));
      break;
    } else if (char < '0' || char > '9') {
      values[units.indexOf(char)] = Number(text.slice(start, at));
      start = at + 1;
    }
  }

  return new temporal.Duration(...values);
};

const isWritten = (value: Temporal.Duration): boolean =>
  value.milliseconds < 1000 &&
  value.microseconds < 1000 &&
  value.nanoseconds < 1000 &&
  pattern.test(value.toString());

const DurationBase: NominalType<
  'nominal.Duration',
  NominalSchema<string | Temporal.Duration, Temporal.Duration>
> = Nominal(
  'nominal.Duration',
  temporalRule<Temporal.Duration>({
    typeName: 'nominal.Duration',
    tag: 'Temporal.Duration',
    pattern,
    description: 'an ISO 8601 duration such as P1DT12H, PT0.5S or P2W',
    json: { examples: ['P1DT12H'] },
    accepts: (temporal, value): value is Temporal.Duration =>
      value instanceof temporal.Duration && isWritten(value),
    build,
  }),
);

/**
 * A length of time in years, months, weeks, days, hours, minutes and seconds, held as a
 * `Temporal.Duration`: a subscription period, a timeout, the time a task may take.
 *
 * @remarks
 * Text is an ISO 8601 duration as RFC 3339 Appendix A writes it: `P`, then the date units `Y`,
 * `M`, `D` in that order, then `T` and the time units `H`, `M`, `S`, such as `P1Y2M3DT4H5M6S`;
 * or weeks alone, `P2W`. Units with nothing in them may be left out, but at least one is
 * present. Letters are upper case, each number has at most nine digits, and only the seconds take a
 * fraction, of up to nine digits after a dot. A sign is refused: a duration here is never
 * negative. A `Temporal.Duration` that its own text would write the same way is taken as well.
 *
 * The JSON Schema carries a `pattern` and no `format`: the `duration` format has no fractions,
 * so a validator such as Ajv would refuse `PT0.5S`.
 *
 * Temporal comes from the runtime: Node.js 26 has it; on older versions load
 * `temporal-polyfill/global` before the first value is built, or the constructor throws a
 * `TypeError` that says so.
 *
 * @example
 * ```ts
 * const timeout = new Duration('PT1M30S');
 * timeout.value.total('seconds'); // 90
 * new Duration('P1D').equals(new Duration('PT24H')); // false: the units differ
 * ```
 */
export class Duration extends DurationBase {
  declare public static readonly '~standard': StandardOf<typeof Duration>;

  /**
   * The whole text the type accepts.
   *
   * @remarks
   * The rule is built from it once, when the class is defined, so a subclass that changes the
   * pattern overrides `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * Whether the other value has the same number in each unit and belongs to this type, a type
   * under it or the type it is under; `P1D` and `PT24H` differ, since a day is not always 24 hours.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) &&
      other instanceof Duration &&
      fields.every((field) => this.value[field] === other.value[field])
    );
  }

  /**
   * The duration as `P1DT12H`, the seconds with a fraction when there is one.
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

    throw noPrimitive(this, 'Temporal.Duration');
  }
}

defineTextForm(Duration, asText);
