import type { SubtypeOf } from '../core/contracts.ts';
import { satisfying } from '../core/predicate-schema.ts';
import { sameType } from '../core/same-type.ts';
import { inOneLine } from '../core/same-value.ts';
import type { StandardOf } from '../core/standard-schema.ts';
import { stringOnly } from '../core/string-rule.ts';
import { AnyString } from '../types/string/any-string.ts';
import { timeZoneName, whole } from './grammar.ts';
import { temporalFor } from './temporal-rule.ts';
import type { TemporalApi } from './temporal-rule.ts';

const pattern = whole(timeZoneName);

// Keyed by the name in lower case. The names the runtime knows are as many as its time zone
// database holds; unknown names, which anyone can make up, are kept up to a limit, since finding
// one unknown costs Temporal an exception.
const knownIds = new Map<string, string>();
const unknownIds = new Set<string>();
const unknownLimit = 1024;
const canonicalIds = new Map<string, string>();

const zoneIn = (temporal: TemporalApi, id: string): Temporal.ZonedDateTime =>
  new temporal.ZonedDateTime(0n, id);

/**
 * The name as the runtime writes it, `Europe/Paris` for `europe/paris`, or `undefined` when the
 * runtime knows no such zone.
 *
 * @throws {@link TypeError} when the runtime has no Temporal; the message names the polyfill.
 *
 * @internal
 */
const knownTimeZone = (text: string): string | undefined => {
  const key = text.toLowerCase();
  const known = knownIds.get(key);

  if (known !== undefined || unknownIds.has(key)) {
    return known;
  }

  const temporal = temporalFor('nominal.TimeZoneId');

  try {
    const id = zoneIn(temporal, text).timeZoneId;

    knownIds.set(key, id);

    return id;
  } catch {
    if (unknownIds.size < unknownLimit) {
      unknownIds.add(key);
    }

    return undefined;
  }
};

/**
 * Whether a value is the name of a zone the runtime knows.
 *
 * @throws {@link TypeError} when the runtime has no Temporal; the message names the polyfill.
 *
 * @internal
 */
const isTimeZoneId = (value: unknown): value is string =>
  typeof value === 'string' && pattern.test(value) && knownTimeZone(value) !== undefined;

// Temporal finds two names of one zone equal but has no way to name the primary one, so it is
// looked for among the names `Intl` lists as primary; the name `Intl.DateTimeFormat` resolves to
// is tried first, which is that name on runtimes whose `Intl` still resolves aliases.
const primaryOf = (temporal: TemporalApi, id: string): string => {
  const primaries = ['UTC', ...Intl.supportedValuesOf('timeZone')];

  if (primaries.includes(id)) {
    return id;
  }

  const zone = zoneIn(temporal, id);
  // @throws-ignore the id comes from Temporal, so Intl knows the zone
  const resolved = new Intl.DateTimeFormat('en-US', { timeZone: id }).resolvedOptions().timeZone;
  const candidates = primaries.includes(resolved) ? [resolved, ...primaries] : primaries;

  return candidates.find((candidate) => zone.equals(zoneIn(temporal, candidate))) ?? id;
};

/**
 * The primary name of a zone, cached by its name in lowercase.
 *
 * @throws {@link TypeError} when the runtime has no Temporal; the message names the polyfill.
 *
 * @internal
 */
const canonicalOf = (text: string): string => {
  const key = text.toLowerCase();
  const cached = canonicalIds.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const temporal = temporalFor('nominal.TimeZoneId');
  const canonical = primaryOf(temporal, zoneIn(temporal, text).timeZoneId);

  canonicalIds.set(key, canonical);

  return canonical;
};

const TimeZoneIdBase: SubtypeOf<typeof AnyString, 'nominal.TimeZoneId'> = AnyString.subtype(
  'nominal.TimeZoneId',
  stringOnly(
    satisfying(isTimeZoneId, 'an IANA time zone name the runtime knows, such as Europe/Paris', {
      type: 'string',
      pattern: pattern.source,
      examples: ['Europe/Paris'],
    }),
  ),
);

/**
 * The name of a time zone from the IANA time zone database, such as `Europe/Paris` or `UTC`: the
 * zone of a user, an office or a `ZonedDateTime`.
 *
 * @remarks
 * The name must be one the runtime knows, as Temporal finds it, so the answer depends on the time
 * zone data of the runtime (ICU in Node.js), which can differ between Node.js versions. Case is
 * free and kept as given. Offsets such as `+02:00` are refused: an offset is not a zone, since it
 * does not follow daylight saving time. The JSON Schema `pattern` checks the shape of a name only.
 *
 * Temporal comes from the runtime: Node.js 26 has it; on older versions load
 * `temporal-polyfill/global` before the first value is built, or the constructor throws a
 * `TypeError` that says so.
 *
 * @example
 * ```ts
 * import { TimeZoneId } from '@horizon-republic/nominal-types/temporal';
 *
 * const zone = new TimeZoneId('europe/paris');
 * zone.canonical().value; // 'Europe/Paris'
 * zone.equals(new TimeZoneId('Europe/Paris')); // true
 * ```
 */
export class TimeZoneId extends TimeZoneIdBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof TimeZoneId>;

  /**
   * The shape of a name, which the JSON Schema carries; whether the runtime knows the zone is
   * checked apart.
   *
   * @remarks
   * The rule is built from it once, when the class is defined, so a subclass that changes the
   * pattern overrides `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The name the runtime holds as the primary one for this zone, with its case: `UTC` for
   * `etc/utc`, and an alias such as `US/Pacific` resolved to `America/Los_Angeles`.
   *
   * @remarks
   * Which name is primary comes from the runtime's time zone data: Node.js 24 gives
   * `Europe/Kiev` for `Europe/Kyiv`, so store the name as it came and use this to compare.
   *
   * @returns A new value of this type that holds the primary name.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public canonical(): this {
    // @throws-ignore an instance exists only once Temporal has checked its name
    const primary = canonicalOf(this.value);

    return sameType(this, primary);
  }

  /**
   * Whether the other value names the same zone, as `canonical()` finds it, and belongs to this
   * type, a type under it or the type it is under.
   *
   * @param other - Any value.
   * @returns Whether the two are equal.
   */
  public override equals(other: unknown): boolean {
    // @throws-ignore an instance exists only once Temporal has checked its name
    return (
      inOneLine(this, other) &&
      other instanceof TimeZoneId &&
      canonicalOf(other.value) === canonicalOf(this.value)
    );
  }
}
