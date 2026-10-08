import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';

import { Instant, TimeZoneId, ZonedDateTime } from '../../src/temporal/index.ts';
import { satisfiesSchema } from '../support/json-schema.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const schema = ZonedDateTime['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

describe('ZonedDateTime', () => {
  it('holds a Temporal.ZonedDateTime and writes RFC 9557 text', () => {
    const meeting = new ZonedDateTime('2024-05-01T09:30:00.25+02:00[Europe/Paris]');

    expect(meeting.value).toBeInstanceOf(Temporal.ZonedDateTime);
    expect(meeting.value.hour).toBe(9);
    expect(meeting.toJSON()).toBe('2024-05-01T09:30:00.25+02:00[Europe/Paris]');
    expect(JSON.stringify({ meeting })).toBe(
      '{"meeting":"2024-05-01T09:30:00.25+02:00[Europe/Paris]"}',
    );
    expect(String(meeting)).toBe('2024-05-01T09:30:00.25+02:00[Europe/Paris]');
  });

  it('writes the zone name as the runtime does', () => {
    expect(new ZonedDateTime('2024-05-01T09:30:00+02:00[europe/paris]').toJSON()).toBe(
      '2024-05-01T09:30:00+02:00[Europe/Paris]',
    );
  });

  it('gives its zone and its moment', () => {
    const meeting = new ZonedDateTime('2024-05-01T09:30:00+02:00[Europe/Paris]');

    expect(meeting.timeZone).toBeInstanceOf(TimeZoneId);
    expect(meeting.timeZone.value).toBe('Europe/Paris');
    expect(meeting.toInstant()).toBeInstanceOf(Instant);
    expect(meeting.toInstant().toJSON()).toBe('2024-05-01T07:30:00Z');
  });

  it.each([
    ['the offset of another season', '2024-05-01T09:30:00+01:00[Europe/Paris]'],
    [
      'a time that daylight saving time skips, at the old offset',
      '2024-03-31T02:30:00+01:00[Europe/Paris]',
    ],
    [
      'a time that daylight saving time skips, at the new offset',
      '2024-03-31T02:30:00+02:00[Europe/Paris]',
    ],
    ['a repeated hour at an offset the zone never has', '2024-10-27T02:30:00+03:00[Europe/Paris]'],
    [
      'an offset of local mean time rounded the wrong way',
      '1900-01-01T00:00:00+00:10[Europe/Paris]',
    ],
    ['an unknown zone', '2024-05-01T09:30:00+02:00[Mars/Olympus]'],
    ['a misspelt zone', '2024-05-01T09:30:00+02:00[Europe/Pariss]'],
    ['a dot for a zone', '2024-05-01T09:30:00+02:00[.]'],
    ['a moment before the year 0000 in UTC', '0000-01-01T00:00:00+01:00[Etc/GMT-1]'],
    ['a moment after the year 9999 in UTC', '9999-12-31T23:59:59-01:00[Etc/GMT+1]'],
  ])('refuses %s, which its JSON Schema cannot see', (_case, text) => {
    expect(ZonedDateTime.parse(text).ok).toBe(false);
    expect(satisfiesSchema(schema, text)).toBe(true);
  });

  it('tells the two times of a repeated hour apart by their offset', () => {
    const first = new ZonedDateTime('2024-10-27T02:30:00+02:00[Europe/Paris]');
    const second = new ZonedDateTime('2024-10-27T02:30:00+01:00[Europe/Paris]');

    expect(first.toInstant().toJSON()).toBe('2024-10-27T00:30:00Z');
    expect(second.toInstant().toJSON()).toBe('2024-10-27T01:30:00Z');
    expect(first.equals(second)).toBe(false);
  });

  it('reads the offset of local mean time to the minute, as Temporal writes it', () => {
    const value = new ZonedDateTime('1900-01-01T00:00:00+00:09[Europe/Paris]');

    expect(value.value.offset).toBe('+00:09:21');
    expect(value.toJSON()).toBe('1900-01-01T00:00:00+00:09[Europe/Paris]');
    expect(value.toInstant().toJSON()).toBe('1899-12-31T23:50:39Z');
  });

  it('takes a Temporal.ZonedDateTime in a named zone as it is', () => {
    const meeting = Temporal.ZonedDateTime.from('2024-05-01T09:30:00+02:00[Europe/Paris]');

    expect(new ZonedDateTime(meeting).value).toBe(meeting);
  });

  it.each([
    Temporal.ZonedDateTime.from('2024-05-01T09:30:00+02:00[+02:00]'),
    Temporal.ZonedDateTime.from('2024-05-01T09:30:00+02:00[Europe/Paris]').withCalendar('gregory'),
    Temporal.ZonedDateTime.from('+010000-01-01T00:00:00+00:00[UTC]'),
    Temporal.ZonedDateTime.from('0000-01-01T00:00:00+01:00[Etc/GMT-1]'),
    Temporal.Instant.from('2024-05-01T09:30:00Z'),
    Temporal.PlainDateTime.from('2024-05-01T09:30:00'),
  ])('refuses %s, which its text form cannot carry', (value) => {
    expect(ZonedDateTime.parse(value).ok).toBe(false);
  });

  it('reads a value of another Temporal implementation through its text', () => {
    // Stands for an implementation whose classes differ from the runtime's, such as a polyfill
    // next to native Temporal.
    class ForeignZonedDateTime {
      public readonly [Symbol.toStringTag] = 'Temporal.ZonedDateTime';

      public constructor(private readonly text: string) {}

      public toString(): string {
        return this.text;
      }
    }

    const foreign = new ForeignZonedDateTime('2024-05-01T09:30:00+02:00[Europe/Paris]');

    expect(valueOf(ZonedDateTime.parse(foreign)).value).toBeInstanceOf(Temporal.ZonedDateTime);
    expect(
      ZonedDateTime.parse(new ForeignZonedDateTime('2024-05-01T09:30:00+01:00[Europe/Paris]')).ok,
    ).toBe(false);
  });

  it('compares the moment, the zone and the calendar', () => {
    const paris = new ZonedDateTime('2024-05-01T09:30:00+02:00[Europe/Paris]');

    expect(paris.equals(new ZonedDateTime('2024-05-01T09:30:00+02:00[europe/paris]'))).toBe(true);
    expect(paris.equals(new ZonedDateTime('2024-05-01T09:30:00+02:00[Europe/Berlin]'))).toBe(false);
    expect(
      paris.equals(new ZonedDateTime('2024-05-01T09:30:00.000000001+02:00[Europe/Paris]')),
    ).toBe(false);
    expect(paris.equals(paris.toInstant())).toBe(false);
    expect(paris.equals(paris.value)).toBe(false);
  });

  it('refuses < and >, and names the compare function to use', () => {
    const earlier = new ZonedDateTime('2024-05-01T09:30:00+02:00[Europe/Paris]');
    const later = new ZonedDateTime('2024-05-01T09:30:00+01:00[Europe/London]');

    expect(() => earlier < later).toThrow(
      'nominal.ZonedDateTime holds a Temporal.ZonedDateTime and has no primitive value; compare with Temporal.ZonedDateTime.compare(a.value, b.value)',
    );
    expect(Temporal.ZonedDateTime.compare(earlier.value, later.value)).toBe(-1);
  });

  it('says what it expects', () => {
    expect(issuesOf(ZonedDateTime.parse('2024-05-01T09:30:00+01:00[Europe/Paris]'))).toStrictEqual([
      {
        message:
          'must be an RFC 9557 date-time as YYYY-MM-DDThh:mm:ss±hh:mm[Area/City], with the offset its time zone has then (was "2024-05-01T09:30:00+01:00[Europe/Paris]")',
      },
    ]);
  });
});
