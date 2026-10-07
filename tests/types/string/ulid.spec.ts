import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { AnyString, NominalError, Ulid, Uuid } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, valueOf } from '../../support/results.ts';

const sample = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const lowest = '0'.repeat(26);
const highest = `7${'Z'.repeat(25)}`;
const schema = Ulid['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

// The same ULID with one character swapped for another.
const withAt = (index: number, character: string): string =>
  sample.slice(0, index) + character + sample.slice(index + 1);

const accepted = [sample, sample.toLowerCase(), '01arz3ndeKTSV4RRFFQ69G5FAV', lowest, highest];
const rejected = [
  '',
  sample.slice(1),
  `${sample}0`,
  `8${'0'.repeat(25)}`,
  `Z${'0'.repeat(25)}`,
  ...['I', 'L', 'O', 'U', 'i', 'l', 'o', 'u'].flatMap((letter) => [
    withAt(5, letter),
    withAt(25, letter),
  ]),
  withAt(10, '-'),
  ` ${sample.slice(1)}`,
  `${sample.slice(0, 25)}\n`,
];

describe('Ulid', () => {
  it.each(accepted)('accepts %s as given', (text) => {
    expect(new Ulid(text).value).toBe(text);
  });

  it.each(rejected)('rejects %j', (text) => {
    expect(() => new Ulid(text)).toThrow(NominalError);
  });

  it('refuses a first character past 7, which would not fit in 128 bits', () => {
    expect(issuesOf(Ulid.parse(`8${'0'.repeat(25)}`))).toStrictEqual([
      { message: 'must be a ULID (was "80000000000000000000000000")' },
    ]);
  });

  it.each([1, null, undefined, {}, new Object(sample)])('rejects %s', (input) => {
    expect(issuesOf(Ulid.parse(input))).toHaveLength(1);
  });

  it.each([...accepted, ...rejected, 26])('agrees with its JSON Schema on %j', (value) => {
    expect(satisfiesSchema(schema, value)).toBe(Ulid.parse(value).ok);
  });

  it('reads the time it was made from the first ten characters', () => {
    expect(new Ulid(sample).timestamp.toISOString()).toBe('2016-07-30T23:54:10.259Z');
    expect(new Ulid(sample.toLowerCase()).timestamp).toStrictEqual(new Ulid(sample).timestamp);
    expect(new Ulid(lowest).timestamp.getTime()).toBe(0);
    expect(new Ulid(highest).timestamp.getTime()).toBe(2 ** 48 - 1);
  });

  it('accepts lowercase like validator.js isULID, yet keeps one id per value', () => {
    const lower = new Ulid(sample.toLowerCase());

    expect(lower.canonical().value).toBe(sample);
    expect(lower.equals(new Ulid(sample))).toBe(true);
    expect(lower.equals(new Ulid(highest))).toBe(false);
    expect(lower.equals(sample)).toBe(false);
  });

  it('stays apart from a string type with the same text', () => {
    expect(new Ulid(sample).equals(new AnyString(sample))).toBe(false);
    expect(new Ulid(sample).equals(new Uuid('6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718'))).toBe(false);
  });

  it('stays fast on a long crafted input', () => {
    const started = performance.now();

    expect(Ulid.parse(`0${'Z'.repeat(100_000)}`).ok).toBe(false);
    expect(Ulid.parse('0'.repeat(100_000)).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('narrows a value built by another copy of the package and compares it', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const id = new copy.Ulid(sample.toLowerCase());

    expect(valueOf(Ulid.parse(id))).toBe(id);
    expect(new Ulid(sample).equals(id)).toBe(true);
    expect(valueOf(Ulid.parse(new copy.AnyString(sample)))).toBeInstanceOf(Ulid);
  });
});
