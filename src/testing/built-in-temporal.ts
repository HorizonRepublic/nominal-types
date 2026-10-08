import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

import { alphabets, characters } from './characters.ts';
import { callOf, propertyOf } from './properties.ts';

// Read from the runtime when a generator is made, since a polyfill may be installed after import.
const temporalClass = (name: string): unknown =>
  propertyOf(propertyOf(globalThis, 'Temporal'), name);

// Names the runtime may also know besides its own list: links to another zone, and the zones of
// `Etc`, which `Intl` leaves out.
const otherNames = [
  'UTC',
  'Etc/UTC',
  'GMT',
  'Etc/GMT+5',
  'Etc/GMT-14',
  'US/Pacific',
  'Asia/Kolkata',
  'Europe/Kyiv',
];

const zoneNames = (): string[] => {
  const listed: unknown = callOf(Intl, 'supportedValuesOf', 'timeZone');

  return [...otherNames, ...(Array.isArray(listed) ? listed.map(String) : [])];
};

// A name as written, in lower case or in upper case.
const anyCase = (names: readonly string[]): Arbitrary<string> =>
  fc
    .tuple(fc.constantFrom(...names), fc.constantFrom('as written', 'as written', 'lower', 'upper'))
    .map(([name, kind]) => {
      if (kind === 'lower') {
        return name.toLowerCase();
      }

      return kind === 'upper' ? name.toUpperCase() : name;
    });

const timeZoneId = (): Arbitrary<unknown> | undefined =>
  temporalClass('ZonedDateTime') === undefined ? undefined : anyCase(zoneNames());

// The epoch nanoseconds of 0001-01-02 and 9999-12-30, inside the years every zone's local time
// and UTC both keep to.
const earliest = -62_135_510_400_000_000_000n;
const latest = 253_402_041_600_000_000_000n;
const day = 86_400_000_000_000n;

const moment = fc.oneof(
  { arbitrary: fc.bigInt({ min: earliest, max: latest }), weight: 1 },
  {
    arbitrary: fc.bigInt({ min: -2_208_988_800_000_000_000n, max: 4_102_444_800_000_000_000n }),
    weight: 3,
  },
);

// Changes of offset after the starts of 2000 and of 2024, looked up once per zone, since finding
// one takes a polyfill about a millisecond.
const transitionStarts = [946_684_800_000_000_000n, 1_704_067_200_000_000_000n];
const transitions = new Map<string, bigint[]>();

type ZonedAt = (epochNanoseconds: bigint, name: string) => unknown;

const transitionsOf = (zonedAt: ZonedAt, name: string): bigint[] => {
  const known = transitions.get(name);

  if (known !== undefined) {
    return known;
  }

  const found = transitionStarts.flatMap((start) => {
    const next = propertyOf(
      callOf(zonedAt(start, name), 'getTimeZoneTransition', 'next'),
      'epochNanoseconds',
    );

    return typeof next === 'bigint' && next <= latest ? [next] : [];
  });

  transitions.set(name, found);

  return found;
};

const zonedDateTime = (): Arbitrary<unknown> | undefined => {
  const zonedClass = temporalClass('ZonedDateTime');

  if (typeof zonedClass !== 'function') {
    return undefined;
  }

  const names = zoneNames();
  const zonedAt: ZonedAt = (epochNanoseconds, name) =>
    Reflect.construct(zonedClass, [epochNanoseconds, name]);

  // A quarter of the moments sit near a change of offset: the last nanosecond before it, the
  // change itself, a second or a day after.
  const nearChange = fc.oneof(
    { arbitrary: fc.constant(null), weight: 3 },
    {
      arbitrary: fc.tuple(fc.nat({ max: 1 }), fc.constantFrom(-1n, 0n, 1_000_000_000n, day)),
      weight: 1,
    },
  );

  return fc
    .tuple(
      fc.constantFrom(...names),
      moment,
      nearChange,
      fc.constantFrom('text', 'text', 'lower-case zone', 'object'),
    )
    .map(([name, epochNanoseconds, near, form]) => {
      const change = near === null ? undefined : transitionsOf(zonedAt, name)[near[0]];
      const at = change === undefined || near === null ? epochNanoseconds : change + near[1];
      const value = zonedAt(at, name);

      if (form === 'object') {
        return value;
      }

      const text = String(callOf(value, 'toString'));
      const bracket = text.indexOf('[');

      return form === 'text' ? text : text.slice(0, bracket) + text.slice(bracket).toLowerCase();
    });
};

const amount = fc.oneof(
  { arbitrary: fc.integer({ min: 0, max: 99 }), weight: 6 },
  { arbitrary: fc.integer({ min: 0, max: 999_999_999 }), weight: 1 },
);

const unit = (letter: string): Arbitrary<string> =>
  fc.option(
    amount.map((count) => `${String(count)}${letter}`),
    { nil: '', freq: 2 },
  );

const seconds = fc.option(
  fc
    .tuple(amount, fc.option(characters(alphabets.digits, 1, 9), { nil: '' }))
    .map(([whole, fraction]) => `${String(whole)}${fraction === '' ? '' : `.${fraction}`}S`),
  { nil: '', freq: 2 },
);

const durationText: Arbitrary<string> = fc.oneof(
  { arbitrary: amount.map((count) => `P${String(count)}W`), weight: 1 },
  {
    arbitrary: fc
      .tuple(unit('Y'), unit('M'), unit('D'), unit('H'), unit('M'), seconds)
      .map(([years, months, days, hours, minutes, time]) => {
        const clock = hours + minutes + time;
        const date = years + months + days;

        if (date === '' && clock === '') {
          return 'PT0S';
        }

        return `P${date}${clock === '' ? '' : `T${clock}`}`;
      }),
    weight: 8,
  },
);

const duration = (): Arbitrary<unknown> | undefined => {
  const durationClass = temporalClass('Duration');

  if (typeof durationClass !== 'function') {
    return undefined;
  }

  return fc
    .tuple(durationText, fc.nat({ max: 15 }))
    .map(([text, form]) => (form === 0 ? callOf(durationClass, 'from', text) : text));
};

/**
 * Internal: generators for the Temporal types whose values depend on the runtime's time zone data
 * or whose grammar a pattern alone makes too narrow: zone names in any case, zoned date-times with
 * the offset each zone has then, near its changes of offset too, and durations in every form.
 */
export const temporalArbitraries: Readonly<Record<string, () => Arbitrary<unknown> | undefined>> = {
  'nominal.Duration': duration,
  'nominal.TimeZoneId': timeZoneId,
  'nominal.ZonedDateTime': zonedDateTime,
};
