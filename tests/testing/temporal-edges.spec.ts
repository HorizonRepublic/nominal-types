import 'temporal-polyfill/global';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { Duration, TimeZoneId, ZonedDateTime } from '../../src/temporal/index.ts';
import { temporalArbitraries } from '../../src/testing/built-in-temporal.ts';
import { arbitraryOf } from '../../src/testing/index.ts';

const zoned = fc.sample(arbitraryOf(ZonedDateTime), { numRuns: 2000, seed: 11 });
const durations = fc.sample(arbitraryOf(Duration), { numRuns: 2000, seed: 11 });
const zones = fc.sample(arbitraryOf(TimeZoneId), { numRuns: 2000, seed: 11 });

const texts = (values: readonly unknown[]): string[] =>
  values.filter((value) => typeof value === 'string');

const zonedValue = (value: unknown): Temporal.ZonedDateTime =>
  value instanceof Temporal.ZonedDateTime ? value : Temporal.ZonedDateTime.from(String(value));

// Whether the zone changed its offset within a day before the moment.
const nearChange = (value: Temporal.ZonedDateTime): boolean => {
  const before = value.toInstant().subtract({ hours: 24 }).toZonedDateTimeISO(value.timeZoneId);

  return before.offsetNanoseconds !== value.offsetNanoseconds;
};

describe('arbitraryOf() for the zoned Temporal types', () => {
  it('makes zoned date-times as text, with zone names in lower case, and as Temporal objects', () => {
    expect(zoned.some((value) => value instanceof Temporal.ZonedDateTime)).toBe(true);
    expect(texts(zoned).some((text) => /\[[a-z_]+\/[^A-Z\]]+\]$/u.test(text))).toBe(true);
    expect(texts(zoned).some((text) => /\[[A-Z]/u.test(text))).toBe(true);
  });

  it('makes zoned date-times next to a change of offset', () => {
    expect(zoned.filter((value) => nearChange(zonedValue(value))).length).toBeGreaterThan(100);
  });

  it('makes zoned date-times in many zones and both signs of offset', () => {
    const values = zoned.map((value) => zonedValue(value));

    expect(new Set(values.map((value) => value.timeZoneId.toLowerCase())).size).toBeGreaterThan(
      200,
    );
    expect(values.some((value) => value.offsetNanoseconds < 0)).toBe(true);
    expect(values.some((value) => value.offsetNanoseconds > 0)).toBe(true);
  });

  it('makes durations of every unit, weeks alone, fractions and Temporal objects', () => {
    const text = texts(durations);

    expect(text.some((value) => /^P\d+W$/u.test(value))).toBe(true);
    expect(text.some((value) => /^P\d+Y\d+M\d+DT\d+H\d+M\d+\.\d+S$/u.test(value))).toBe(true);
    expect(text.some((value) => /\.\d{9}S$/u.test(value))).toBe(true);
    expect(text.some((value) => /\d{9}[YMDHS]/u.test(value))).toBe(true);
    expect(durations.some((value) => value instanceof Temporal.Duration)).toBe(true);
  });

  it('makes zone names in any case, UTC and older names among them', () => {
    expect(zones.some((name) => name === name.toLowerCase())).toBe(true);
    expect(zones.some((name) => name === name.toUpperCase())).toBe(true);
    expect(zones.map((name) => name.toLowerCase())).toContain('utc');
    expect(zones.map((name) => name.toLowerCase())).toContain('us/pacific');
  });

  it('leaves the zoned types to their pattern when the runtime has no Temporal', () => {
    const saved: unknown = Reflect.get(globalThis, 'Temporal');

    Reflect.deleteProperty(globalThis, 'Temporal');

    try {
      expect(Object.values(temporalArbitraries).map((make) => make())).toStrictEqual([
        undefined,
        undefined,
        undefined,
      ]);
    } finally {
      Reflect.set(globalThis, 'Temporal', saved);
    }
  });
});
