import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';

import { Duration } from '../../src/temporal/index.ts';
import { issuesOf } from '../support/results.ts';

const fieldsOf = (duration: Duration): number[] => [
  duration.value.years,
  duration.value.months,
  duration.value.weeks,
  duration.value.days,
  duration.value.hours,
  duration.value.minutes,
  duration.value.seconds,
  duration.value.milliseconds,
  duration.value.microseconds,
  duration.value.nanoseconds,
];

describe('Duration', () => {
  it('holds a Temporal.Duration and writes its text', () => {
    const period = new Duration('P1Y2M3DT4H5M6.5S');

    expect(period.value).toBeInstanceOf(Temporal.Duration);
    expect(period.toJSON()).toBe('P1Y2M3DT4H5M6.5S');
    expect(JSON.stringify({ period })).toBe('{"period":"P1Y2M3DT4H5M6.5S"}');
    expect(String(period)).toBe('P1Y2M3DT4H5M6.5S');
  });

  it.each([
    ['P1Y2M3DT4H5M6S', [1, 2, 0, 3, 4, 5, 6, 0, 0, 0]],
    ['P2W', [0, 0, 2, 0, 0, 0, 0, 0, 0, 0]],
    ['P1M', [0, 1, 0, 0, 0, 0, 0, 0, 0, 0]],
    ['PT1M', [0, 0, 0, 0, 0, 1, 0, 0, 0, 0]],
    ['P1MT1M', [0, 1, 0, 0, 0, 1, 0, 0, 0, 0]],
    ['P1Y3D', [1, 0, 0, 3, 0, 0, 0, 0, 0, 0]],
    ['PT1H5S', [0, 0, 0, 0, 1, 0, 5, 0, 0, 0]],
    ['PT36H', [0, 0, 0, 0, 36, 0, 0, 0, 0, 0]],
    ['PT0.5S', [0, 0, 0, 0, 0, 0, 0, 500, 0, 0]],
    ['PT1.123456789S', [0, 0, 0, 0, 0, 0, 1, 123, 456, 789]],
    ['PT0.000001S', [0, 0, 0, 0, 0, 0, 0, 0, 1, 0]],
    ['P01D', [0, 0, 0, 1, 0, 0, 0, 0, 0, 0]],
  ])('reads %s field by field, as Temporal does', (text, fields) => {
    const duration = new Duration(text);

    expect(fieldsOf(duration)).toStrictEqual(fields);
    expect(fieldsOf(new Duration(Temporal.Duration.from(text)))).toStrictEqual(fields);
  });

  it('writes the zero duration as PT0S', () => {
    expect(new Duration('P0D').toJSON()).toBe('PT0S');
  });

  it('takes a Temporal.Duration as it is when its text is one the type reads', () => {
    const timeout = Temporal.Duration.from({ minutes: 1, seconds: 30 });

    expect(new Duration(timeout).value).toBe(timeout);
  });

  it('reads a Temporal.Duration with more than 999 of a unit below a second through its text', () => {
    const duration = new Duration(Temporal.Duration.from({ milliseconds: 1500 }));

    expect(fieldsOf(duration)).toStrictEqual([0, 0, 0, 0, 0, 0, 1, 500, 0, 0]);
    expect(duration.equals(new Duration('PT1.5S'))).toBe(true);
  });

  it.each([
    Temporal.Duration.from('-P1D'),
    Temporal.Duration.from('P1W2D'),
    Temporal.Duration.from({ seconds: 1_000_000_000 }),
    Temporal.Duration.from({ years: 1_000_000_000 }),
  ])('refuses %s, whose text the type does not read', (duration) => {
    expect(Duration.parse(duration).ok).toBe(false);
  });

  it('compares unit by unit, so a day is not 24 hours', () => {
    expect(new Duration('P1D').equals(new Duration('P1D'))).toBe(true);
    expect(new Duration('PT1.5S').equals(new Duration('PT1.500S'))).toBe(true);
    expect(new Duration('P0D').equals(new Duration('PT0S'))).toBe(true);
    expect(new Duration('P1D').equals(new Duration('PT24H'))).toBe(false);
    expect(new Duration('PT90M').equals(new Duration('PT1H30M'))).toBe(false);
    expect(new Duration('P2W').equals(new Duration('P14D'))).toBe(false);
    expect(new Duration('P1D').equals('P1D')).toBe(false);
  });

  it('refuses < and >, and names the compare function to use', () => {
    expect(() => new Duration('PT1H') > new Duration('PT2H')).toThrow(
      'nominal.Duration holds a Temporal.Duration and has no primitive value; compare with Temporal.Duration.compare(a.value, b.value)',
    );
    expect(Temporal.Duration.compare(new Duration('PT1H').value, new Duration('PT2H').value)).toBe(
      -1,
    );
  });

  it('gives totals through Temporal', () => {
    expect(new Duration('PT1M30S').value.total('seconds')).toBe(90);
  });

  it('says what it expects', () => {
    expect(issuesOf(Duration.parse('-P1D'))).toStrictEqual([
      { message: 'must be an ISO 8601 duration such as P1DT12H, PT0.5S or P2W (was "-P1D")' },
    ]);
  });
});
