import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';

import { Instant, PlainDateTime } from '../../src/temporal/index.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const offsets = ['Z', '+05:45', '-09:30', '+23:59', '-23:59', '-00:00'];
const fractions = ['', '.5', '.001', '.123456', '.999999999'];
const years = [0, 1, 4, 99, 100, 400, 1582, 1900, 1969, 1970, 2000, 2024, 2100, 9999];
const sweep = years.flatMap((year, index) => {
  const date = `${String(year).padStart(4, '0')}-0${String((index % 9) + 1)}-28`;
  const fraction = fractions[index % fractions.length] ?? '';

  return offsets.map((offset) => `${date}T13:07:59${fraction}${offset}`);
});

describe('Instant', () => {
  it('holds a Temporal.Instant and writes UTC text', () => {
    const sent = new Instant('2024-05-01T11:30:00.250+02:00');

    expect(sent.value).toBeInstanceOf(Temporal.Instant);
    expect(sent.value.epochMilliseconds).toBe(Date.UTC(2024, 4, 1, 9, 30, 0, 250));
    expect(sent.toJSON()).toBe('2024-05-01T09:30:00.25Z');
    expect(JSON.stringify({ sent })).toBe('{"sent":"2024-05-01T09:30:00.25Z"}');
    expect(String(sent)).toBe('2024-05-01T09:30:00.25Z');
  });

  it('reads -00:00 as UTC', () => {
    expect(new Instant('2024-05-01T09:30:00-00:00').toJSON()).toBe('2024-05-01T09:30:00Z');
  });

  it('reaches the edges of the year range with the widest offsets', () => {
    expect(new Instant('0000-01-01T00:00:00+23:59').value.epochMilliseconds).toBe(
      -62_167_219_200_000 - (23 * 60 + 59) * 60_000,
    );
    expect(new Instant('9999-12-31T23:59:59-23:59').value.epochMilliseconds).toBe(
      253_402_300_799_000 + (23 * 60 + 59) * 60_000,
    );
  });

  it.each(sweep)('builds %s as Temporal reads it', (text) => {
    expect(new Instant(text).value.epochNanoseconds).toBe(
      Temporal.Instant.from(text).epochNanoseconds,
    );
  });

  it('takes a Temporal.Instant as it is', () => {
    const moment = Temporal.Instant.from('2024-05-01T09:30:00Z');

    expect(new Instant(moment).value).toBe(moment);
  });

  it.each([
    Temporal.Instant.fromEpochMilliseconds(253_402_300_800_000),
    Temporal.Instant.fromEpochMilliseconds(-62_167_219_200_001),
  ])('refuses %s, whose UTC text leaves the year range', (moment) => {
    expect(Instant.parse(moment).ok).toBe(false);
  });

  it.each([
    Temporal.PlainDateTime.from('2024-05-01T09:30:00'),
    Temporal.ZonedDateTime.from('2024-05-01T09:30:00+02:00[Europe/Berlin]'),
    Temporal.PlainDate.from('2024-05-01'),
  ])('refuses another Temporal type, %s', (value) => {
    expect(Instant.parse(value).ok).toBe(false);
  });

  it('reads an instant of another Temporal implementation through its text', () => {
    // Stands for an implementation whose classes differ from the runtime's, such as a polyfill
    // next to native Temporal.
    class ForeignInstant {
      public readonly [Symbol.toStringTag] = 'Temporal.Instant';

      public constructor(private readonly text: string) {}

      public toString(): string {
        return this.text;
      }
    }

    expect(valueOf(Instant.parse(new ForeignInstant('2024-05-01T09:30:00Z'))).value).toBeInstanceOf(
      Temporal.Instant,
    );
    expect(Instant.parse(new ForeignInstant('2024-05-01T23:59:60Z')).ok).toBe(false);
  });

  it.each([
    { [Symbol.toStringTag]: 'Temporal.Instant', toString: 42 },
    { [Symbol.toStringTag]: 'Temporal.Instant', toString: () => 42 },
  ])('refuses a tagged object without text, %o', (value) => {
    expect(Instant.parse(value).ok).toBe(false);
  });

  it('compares moments, not text', () => {
    const utc = new Instant('2024-05-01T09:30:00Z');

    expect(utc.equals(new Instant('2024-05-01T11:30:00+02:00'))).toBe(true);
    expect(utc.equals(new Instant('2024-05-01T09:30:00.000000001Z'))).toBe(false);
    expect(utc.equals('2024-05-01T09:30:00Z')).toBe(false);
    expect(utc.equals(utc.value)).toBe(false);
    expect(utc.equals(new PlainDateTime('2024-05-01T09:30:00'))).toBe(false);
  });

  it('refuses < and >, and names the compare function to use', () => {
    const earlier = new Instant('2024-05-01T09:30:00Z');
    const later = new Instant('2024-05-01T10:30:00Z');

    expect(() => earlier < later).toThrow(
      'nominal.Instant holds a Temporal.Instant and has no primitive value; compare with Temporal.Instant.compare(a.value, b.value)',
    );
    expect(Temporal.Instant.compare(earlier.value, later.value)).toBe(-1);
  });

  it('converts to a Date, to the millisecond', () => {
    expect(new Instant('2024-05-01T09:30:00.123456789Z').toDate()).toStrictEqual(
      new Date('2024-05-01T09:30:00.123Z'),
    );
  });

  it('says what it expects', () => {
    expect(issuesOf(Instant.parse('2024-05-01 09:30:00Z'))).toStrictEqual([
      { message: 'must be an RFC 3339 date-time with Z or an offset (was "2024-05-01 09:30:00Z")' },
    ]);
  });
});
