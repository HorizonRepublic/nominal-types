import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';

import { AnyString } from '../../src/index.ts';
import { TimeZoneId } from '../../src/temporal/index.ts';
import { satisfiesSchema } from '../support/json-schema.ts';
import { issuesOf } from '../support/results.ts';

class OfficeZone extends TimeZoneId.subtype('hr.OfficeZone') {}

const schema = TimeZoneId['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

describe('TimeZoneId', () => {
  it('holds the name as given, under AnyString', () => {
    const zone = new TimeZoneId('europe/paris');

    expect(zone.value).toBe('europe/paris');
    expect(zone).toBeInstanceOf(AnyString);
    expect(zone.toJSON()).toBe('europe/paris');
  });

  it.each(['Mars/Olympus', 'Europe/Pariss', 'Z', 'UTC+2', 'Etc/GMT+15', '.', '..'])(
    'refuses %s, a name the runtime does not know, which its JSON Schema cannot see',
    (text) => {
      expect(TimeZoneId.parse(text).ok).toBe(false);
      expect(satisfiesSchema(schema, text)).toBe(true);
    },
  );

  it('refuses an unknown name each time it is asked', () => {
    expect(TimeZoneId.parse('Mars/Olympus').ok).toBe(false);
    expect(TimeZoneId.parse('mars/olympus').ok).toBe(false);
  });

  it('refuses unknown names past the number it remembers', () => {
    const names = Array.from({ length: 1100 }, (_, index) => `Mars/Base${String(index)}`);

    expect(names.filter((name) => TimeZoneId.parse(name).ok)).toStrictEqual([]);
    expect(TimeZoneId.parse('Mars/Base1099').ok).toBe(false);
    expect(TimeZoneId.parse('Europe/Rome').ok).toBe(true);
  });

  it.each([
    ['europe/paris', 'Europe/Paris'],
    ['EUROPE/PARIS', 'Europe/Paris'],
    ['utc', 'UTC'],
    ['Etc/UTC', 'UTC'],
    ['GMT', 'UTC'],
    ['US/Pacific', 'America/Los_Angeles'],
    ['Etc/GMT+5', 'Etc/GMT+5'],
  ])('gives %s the canonical name %s', (text, canonical) => {
    expect(new TimeZoneId(text).canonical().value).toBe(canonical);
  });

  it('gives two names of one zone the same canonical name, whichever the runtime holds primary', () => {
    const kolkata = new TimeZoneId('Asia/Kolkata').canonical().value;

    expect(['Asia/Kolkata', 'Asia/Calcutta']).toContain(kolkata);
    expect(new TimeZoneId('asia/calcutta').canonical().value).toBe(kolkata);
    expect(new TimeZoneId('Europe/Kyiv').canonical().value).toBe(
      new TimeZoneId('Europe/Kiev').canonical().value,
    );
  });

  it('keeps a subtype in canonical()', () => {
    const zone = new OfficeZone('europe/paris').canonical();

    expect(zone).toBeInstanceOf(OfficeZone);
    expect(zone.value).toBe('Europe/Paris');
  });

  it('compares zones, not text', () => {
    const utc = new TimeZoneId('UTC');

    expect(utc.equals(new TimeZoneId('utc'))).toBe(true);
    expect(utc.equals(new TimeZoneId('Etc/UTC'))).toBe(true);
    expect(new TimeZoneId('Asia/Kolkata').equals(new TimeZoneId('Asia/Calcutta'))).toBe(true);
    expect(new TimeZoneId('Europe/Paris').equals(new TimeZoneId('Europe/Berlin'))).toBe(false);
    expect(utc.equals('UTC')).toBe(false);
    expect(utc.equals(new AnyString('UTC'))).toBe(false);
  });

  it('says what it expects', () => {
    expect(issuesOf(TimeZoneId.parse('+02:00'))).toStrictEqual([
      {
        message:
          'must be an IANA time zone name the runtime knows, such as Europe/Paris (was "+02:00")',
      },
    ]);
  });
});
