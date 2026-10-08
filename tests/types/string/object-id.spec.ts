import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { NominalError, ObjectId } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, valueOf } from '../../support/results.ts';

const sample = '507f1f77bcf86cd799439011';
const schema = ObjectId['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

const accepted = [sample, sample.toUpperCase(), '507F1f77bcf86cd799439011', '0'.repeat(24)];
const rejected = [
  '',
  sample.slice(1),
  `${sample}0`,
  `${sample.slice(0, 23)}g`,
  `0x${sample.slice(2)}`,
  ` ${sample.slice(1)}`,
  `${sample.slice(0, 23)}\n`,
  '507f1f77-bcf8-6cd7-9943-9011',
];

describe('ObjectId', () => {
  it.each(accepted)('accepts %s as given', (text) => {
    expect(new ObjectId(text).value).toBe(text);
  });

  it.each(rejected)('rejects %j', (text) => {
    expect(() => new ObjectId(text)).toThrow(NominalError);
  });

  it('says what it wanted', () => {
    expect(issuesOf(ObjectId.parse('nope'))).toStrictEqual([
      { message: 'must be an ObjectId (was "nope")' },
    ]);
  });

  it.each([1, null, {}, new Object(sample)])('rejects %s', (input) => {
    expect(issuesOf(ObjectId.parse(input))).toHaveLength(1);
  });

  it.each([...accepted, ...rejected, 24])('agrees with its JSON Schema on %j', (value) => {
    expect(satisfiesSchema(schema, value)).toBe(ObjectId.parse(value).ok);
  });

  it('reads the second it was made from the first eight digits', () => {
    expect(new ObjectId(sample).timestamp.toISOString()).toBe('2012-10-17T21:13:27.000Z');
    expect(new ObjectId(`ffffffff${'0'.repeat(16)}`).timestamp.getTime()).toBe(
      (2 ** 32 - 1) * 1000,
    );
  });

  it('accepts all zeros and uppercase like validator.js isMongoId, with one id per value', () => {
    const upper = new ObjectId(sample.toUpperCase());

    expect(new ObjectId('0'.repeat(24)).timestamp.getTime()).toBe(0);
    expect(upper.canonical().value).toBe(sample);
    expect(upper.equals(new ObjectId(sample))).toBe(true);
    expect(upper.equals(new ObjectId('0'.repeat(24)))).toBe(false);
  });

  it('stays fast on a long crafted input', () => {
    const started = performance.now();

    expect(ObjectId.parse('a'.repeat(100_000)).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('narrows a value built by another copy of the package and compares it', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const id = new copy.ObjectId(sample.toUpperCase());

    expect(valueOf(ObjectId.parse(id))).toStrictEqual(new ObjectId(sample.toUpperCase()));
    expect(new ObjectId(sample).equals(id)).toBe(true);
  });
});
