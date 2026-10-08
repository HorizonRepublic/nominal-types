import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';

import { PlainDate, PlainDateTime, PlainTime } from '../../src/temporal/index.ts';
import { issuesOf } from '../support/results.ts';

describe('PlainDate', () => {
  it('holds a Temporal.PlainDate', () => {
    const due = new PlainDate('2024-02-29');

    expect(due.value).toBeInstanceOf(Temporal.PlainDate);
    expect(due.value.dayOfWeek).toBe(4);
    expect(due.toJSON()).toBe('2024-02-29');
    expect(String(due)).toBe('2024-02-29');
  });

  it('takes a Temporal.PlainDate in the ISO 8601 calendar', () => {
    const date = Temporal.PlainDate.from('2024-05-01');

    expect(new PlainDate(date).value).toBe(date);
  });

  it.each([
    Temporal.PlainDate.from({ year: 10_000, month: 1, day: 1 }),
    Temporal.PlainDate.from({ year: -1, month: 12, day: 31 }),
    Temporal.PlainDate.from('2024-05-01').withCalendar('gregory'),
  ])('refuses %s, which its text form cannot carry', (date) => {
    expect(PlainDate.parse(date).ok).toBe(false);
  });

  it('compares dates', () => {
    expect(new PlainDate('2024-05-01').equals(new PlainDate('2024-05-01'))).toBe(true);
    expect(new PlainDate('2024-05-01').equals(new PlainDate('2024-05-02'))).toBe(false);
    expect(() => new PlainDate('2024-05-01') > new PlainDate('2024-05-02')).toThrow(TypeError);
  });

  it('says what it expects', () => {
    expect(issuesOf(PlainDate.parse('2023-02-29'))).toStrictEqual([
      { message: 'must be a calendar date as YYYY-MM-DD (was "2023-02-29")' },
    ]);
  });
});

describe('PlainTime', () => {
  it('holds a Temporal.PlainTime down to the nanosecond', () => {
    const time = new PlainTime('23:59:59.123456789');

    expect(time.value).toBeInstanceOf(Temporal.PlainTime);
    expect([time.value.millisecond, time.value.microsecond, time.value.nanosecond]).toStrictEqual([
      123, 456, 789,
    ]);
    expect(time.toJSON()).toBe('23:59:59.123456789');
    expect(String(time)).toBe('23:59:59.123456789');
  });

  it('writes the seconds Temporal keeps', () => {
    expect(new PlainTime('09:30:00.500').toJSON()).toBe('09:30:00.5');
  });

  it('takes a Temporal.PlainTime', () => {
    const time = Temporal.PlainTime.from('09:30:00');

    expect(new PlainTime(time).value).toBe(time);
  });

  it('reads a time without seconds, as an HTML time input sends it', () => {
    const opens = new PlainTime('09:30');

    expect(opens.value.equals(Temporal.PlainTime.from('09:30:00'))).toBe(true);
    expect(opens.equals(new PlainTime('09:30:00'))).toBe(true);
    expect(opens.toJSON()).toBe('09:30:00');
    expect(new PlainTime('23:59').value.second).toBe(0);
  });

  it('says what it expects', () => {
    expect(issuesOf(PlainTime.parse('9:30'))).toStrictEqual([
      { message: 'must be a time of day as hh:mm or hh:mm:ss (was "9:30")' },
    ]);
  });

  it('compares times', () => {
    expect(new PlainTime('09:30:00').equals(new PlainTime('09:30:00.000'))).toBe(true);
    expect(new PlainTime('09:30:00').equals(new PlainTime('09:30:01'))).toBe(false);
    expect(() => +new PlainTime('09:30:00')).toThrow(TypeError);
  });
});

describe('PlainDateTime', () => {
  it('holds a Temporal.PlainDateTime', () => {
    const meeting = new PlainDateTime('2024-05-01T09:30:00.25');

    expect(meeting.value).toBeInstanceOf(Temporal.PlainDateTime);
    expect(meeting.value.toPlainDate().toString()).toBe('2024-05-01');
    expect(meeting.toJSON()).toBe('2024-05-01T09:30:00.25');
    expect(String(meeting)).toBe('2024-05-01T09:30:00.25');
    expect(() => +meeting).toThrow(
      'nominal.PlainDateTime holds a Temporal.PlainDateTime and has no primitive value; compare with Temporal.PlainDateTime.compare(a.value, b.value)',
    );
  });

  it('takes a Temporal.PlainDateTime in range', () => {
    const meeting = Temporal.PlainDateTime.from('2024-05-01T09:30:00');

    expect(new PlainDateTime(meeting).value).toBe(meeting);
    expect(PlainDateTime.parse(Temporal.PlainDateTime.from('+010000-01-01T00:00:00')).ok).toBe(
      false,
    );
  });

  it('reads a date-time without seconds, as an HTML datetime-local input sends it', () => {
    const meeting = new PlainDateTime('2024-05-01T09:30');

    expect(meeting.value.equals(Temporal.PlainDateTime.from('2024-05-01T09:30:00'))).toBe(true);
    expect(meeting.equals(new PlainDateTime('2024-05-01T09:30:00'))).toBe(true);
    expect(meeting.toJSON()).toBe('2024-05-01T09:30:00');
  });

  it('says what it expects', () => {
    expect(issuesOf(PlainDateTime.parse('2024-05-01T09:30Z'))).toStrictEqual([
      {
        message:
          'must be a date and time as YYYY-MM-DDThh:mm or YYYY-MM-DDThh:mm:ss without an offset (was "2024-05-01T09:30Z")',
      },
    ]);
  });

  it('compares date-times', () => {
    expect(
      new PlainDateTime('2024-05-01T09:30:00').equals(new PlainDateTime('2024-05-01T09:30:00')),
    ).toBe(true);
    expect(
      new PlainDateTime('2024-05-01T09:30:00').equals(new PlainDateTime('2024-05-01T09:30:01')),
    ).toBe(false);
  });
});
