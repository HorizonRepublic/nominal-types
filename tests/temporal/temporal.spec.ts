import 'temporal-polyfill/global';
import { describe, expect, it, vi } from 'vitest';

import { n, NominalError } from '../../src/index.ts';
import { Instant, PlainDate, PlainDateTime, PlainTime } from '../../src/temporal/index.ts';
import { issuesOf, thrownBy, valueOf } from '../support/results.ts';

const isModern = (value: unknown): value is Temporal.PlainDate =>
  value instanceof Temporal.PlainDate && Temporal.PlainDate.compare(value, '1900-01-01') >= 0;

class BirthDate extends PlainDate.subtype(
  'temporal.BirthDate',
  n.satisfying(isModern, 'a date from 1900 on', {}),
) {}

const temporal = Object.getOwnPropertyDescriptor(globalThis, 'Temporal') ?? {};
const rounds = Array.from({ length: 20_000 }, (_, index) => index);

describe('the Temporal types', () => {
  it.each([
    [Instant, 'date-time'],
    [PlainDate, 'date'],
  ])('describe %o with the %s format beside the pattern', (type, format) => {
    expect(type['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toMatchObject({
      type: 'string',
      format,
      pattern: type.pattern.source,
    });
  });

  it.each([PlainTime, PlainDateTime])('describe %o with a pattern and no format', (type) => {
    const schema = type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

    expect(schema).toMatchObject({ type: 'string', pattern: type.pattern.source });
    expect(schema).not.toHaveProperty('format');
  });

  it('build values from instances of another copy of the package', async () => {
    vi.resetModules();

    const copy = await import('../../src/temporal/index.ts');
    const other = new copy.Instant('2024-05-01T09:30:00Z');

    expect(other.constructor).not.toBe(Instant);
    expect(valueOf(Instant.parse(other)).equals(new Instant('2024-05-01T09:30:00Z'))).toBe(true);
    expect(new Instant('2024-05-01T09:30:00Z').equals(other)).toBe(true);
    expect(valueOf(PlainDate.parse(new copy.PlainDate('2024-05-01'))).toJSON()).toBe('2024-05-01');
  });

  it('take subtypes with rules on the Temporal value', () => {
    expect(new BirthDate('1990-07-15').value.year).toBe(1990);
    expect(issuesOf(BirthDate.parse('1899-12-31'))).toStrictEqual([
      { message: 'must be a date from 1900 on (was object)' },
    ]);
    expect(new BirthDate('1990-07-15').equals(new PlainDate('1990-07-15'))).toBe(true);
  });

  it('throw a TypeError naming the polyfill when the runtime has no Temporal', () => {
    Reflect.deleteProperty(globalThis, 'Temporal');

    try {
      const error = thrownBy(() => new PlainDate('2024-05-01'));

      expect(error).toBeInstanceOf(TypeError);
      expect(error).not.toBeInstanceOf(NominalError);
      expect(String(error)).toBe(
        "TypeError: nominal.PlainDate needs Temporal, which this runtime lacks: import 'temporal-polyfill/global' before the first value is built",
      );
      expect(() => Instant.parse('2024-05-01T09:30:00Z')).toThrow(/temporal-polyfill\/global/u);
      expect(PlainTime.parse('nope').ok).toBe(false);
      expect(PlainTime.parse(42).ok).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'Temporal', temporal);
    }
  });

  it('parse valid and invalid text fast enough for a server', () => {
    const started = performance.now();
    const results = rounds.map(() => [
      Instant.parse('2024-05-01T11:30:00.123+02:00').ok,
      Instant.parse('2024-05-01 11:30:00+02:00').ok,
      PlainDate.parse('2024-02-29').ok,
      PlainDate.parse('2023-02-29').ok,
    ]);

    expect(performance.now() - started).toBeLessThan(1000);
    expect(new Set(results.map((result) => result.join()))).toStrictEqual(
      new Set(['true,false,true,false']),
    );
  });
});
