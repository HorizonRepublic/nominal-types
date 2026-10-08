import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';

import { n } from '../../src/index.ts';
import type { AnyNominalType } from '../../src/index.ts';
import { Instant, PlainDate, PlainDateTime, PlainTime } from '../../src/temporal/index.ts';
import { satisfiesSchema } from '../support/json-schema.ts';
import { issuesOf, valueOf } from '../support/results.ts';
import { dates, dateTimes, instants, notStrings, times } from './samples.ts';

const cases: ReadonlyArray<
  readonly [
    AnyNominalType,
    { readonly accepted: string[]; readonly refused: string[]; readonly huge: string },
  ]
> = [
  [Instant, { ...instants, huge: `2024-05-01T09:30:00Z${'0'.repeat(5_000_000)}` }],
  [PlainDate, { ...dates, huge: `2024-05-01${'0'.repeat(5_000_000)}` }],
  [PlainTime, { ...times, huge: `09:30:00.${'0'.repeat(5_000_000)}` }],
  [PlainDateTime, { ...dateTimes, huge: `2024-05-01T09:30:00.${'0'.repeat(5_000_000)}` }],
];

describe.each(cases)('%o', (type, { accepted, refused, huge }) => {
  const input = type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
  const output = type['~standard'].jsonSchema.output({ target: 'draft-2020-12' });

  it.each(accepted)('accepts %j, as its JSON Schema does', (text) => {
    expect(type.parse(text).ok).toBe(true);
    expect(satisfiesSchema(input, text)).toBe(true);
  });

  it.each(refused)('refuses %j, as its JSON Schema does', (text) => {
    expect(type.parse(text).ok).toBe(false);
    expect(satisfiesSchema(input, text)).toBe(false);
  });

  it.each(notStrings)('refuses %o', (value) => {
    expect(issuesOf(type.parse(value))).toHaveLength(1);
  });

  it.each(accepted)('writes %j as text its JSON Schema describes', (text) => {
    const json = valueOf(type.parse(text)).toJSON();

    expect(satisfiesSchema(output, json)).toBe(true);
  });

  it.each(accepted)('reads %j from strings', (text) => {
    expect(valueOf(n.of(type).fromString().parse(text)).equals(valueOf(type.parse(text)))).toBe(
      true,
    );
  });

  it('keeps only examples it accepts', () => {
    const examples = [Reflect.get(input, 'examples')].flat();

    expect(examples.length).toBeGreaterThan(0);
    expect(examples.every((example: unknown) => type.parse(example).ok)).toBe(true);
  });

  it('refuses a huge string quickly', () => {
    const started = performance.now();

    expect(type.parse(huge).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });
});
