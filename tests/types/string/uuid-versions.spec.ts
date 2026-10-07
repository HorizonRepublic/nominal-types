import { describe, expect, it, vi } from 'vitest';

import { columnKindOf } from '../../../src/adapters/orm/column.ts';
import type * as library from '../../../src/index.ts';
import { Uuid, UuidV4, UuidV7 } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, valueOf } from '../../support/results.ts';

const v4 = '6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718';
const v7 = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';
const nil = '00000000-0000-0000-0000-000000000000';
const max = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

// The same UUID with the version digit swapped.
const asVersion = (text: string, version: string): string =>
  `${text.slice(0, 14)}${version}${text.slice(15)}`;

describe.each([
  [UuidV4, v4, v7, '4', 'a version 4 UUID'],
  [UuidV7, v7, v4, '7', 'a version 7 UUID'],
] as const)('%o', (type, sample, otherVersion, version, description) => {
  const schema = type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
  const accepted = [sample, sample.toUpperCase()];
  const rejected = [
    ...['1', '2', '3', '4', '5', '6', '7', '8']
      .filter((other) => other !== version)
      .map((other) => asVersion(sample, other)),
    `${sample.slice(0, 19)}c${sample.slice(20)}`,
    `${sample.slice(0, 19)}7${sample.slice(20)}`,
    sample.replaceAll('-', ''),
    `{${sample}}`,
    '',
  ];

  it.each(accepted)('accepts %s as given', (text) => {
    expect(new type(text).value).toBe(text);
  });

  it.each(rejected)('rejects %j', (text) => {
    expect(type.parse(text).ok).toBe(false);
  });

  it('refuses the nil and max UUIDs, which validator.js isUUID takes by default', () => {
    expect(issuesOf(type.parse(nil))).toStrictEqual([
      { message: `must be ${description} (was "${nil}")` },
    ]);
    expect(type.parse(max).ok).toBe(false);
    expect(type.parse(max.toUpperCase()).ok).toBe(false);
  });

  it.each([...accepted, ...rejected, nil, max, 4])('agrees with its JSON Schema on %j', (value) => {
    expect(satisfiesSchema(schema, value)).toBe(type.parse(value).ok);
  });

  it.each([...accepted, ...rejected, nil, max])('agrees with its static pattern on %j', (value) => {
    expect(type.pattern.test(value)).toBe(type.parse(value).ok);
  });

  it('is stored in a uuid column', () => {
    expect(columnKindOf(type)).toStrictEqual({ kind: 'uuid' });
  });

  it('passes where Uuid is expected, and narrows a Uuid of its version', () => {
    const id = new type(sample);

    expect(id).toBeInstanceOf(Uuid);
    expect(valueOf(Uuid.parse(id))).toBe(id);
    expect(valueOf(type.parse(new Uuid(sample)))).toBeInstanceOf(type);
    expect(type.parse(new Uuid(otherVersion)).ok).toBe(false);
  });

  it('keeps its own type through canonical()', () => {
    const lowered = new type(sample.toUpperCase()).canonical();

    expect(lowered).toBeInstanceOf(type);
    expect(lowered.value).toBe(sample);
  });

  it('compares with a Uuid regardless of case, in either direction', () => {
    expect(new type(sample.toUpperCase()).equals(new Uuid(sample))).toBe(true);
    expect(new Uuid(sample).equals(new type(sample.toUpperCase()))).toBe(true);
  });

  it('stays fast on a long crafted input', () => {
    const started = performance.now();

    expect(type.parse(`${sample.slice(0, 35)}${'f'.repeat(100_000)}`).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('narrows a value built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const id = new copy.Uuid(sample);

    expect(valueOf(type.parse(id))).toBeInstanceOf(type);
    expect(new type(sample).equals(id)).toBe(true);
  });
});

describe('UuidV7', () => {
  it('always has a generation time', () => {
    const timestamp: Date = new UuidV7(v7).timestamp;

    expect(timestamp).toStrictEqual(new Uuid(v7).timestamp);
    expect(timestamp.toISOString()).toBe('2024-07-27T01:15:56.618Z');
  });
});

describe('UuidV4', () => {
  it('has no generation time', () => {
    expect(new UuidV4(v4).timestamp).toBeUndefined();
  });
});
