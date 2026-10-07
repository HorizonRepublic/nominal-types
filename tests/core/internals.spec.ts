import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { ChainSchema } from '../../src/core/chain-schema.ts';
import { levelOf, rulesOf } from '../../src/core/hierarchy.ts';
import { matching } from '../../src/index.ts';

class Root {}
class Plain extends Root {}

describe('internals', () => {
  describe('ChainSchema', () => {
    const chain = new ChainSchema([matching(/^a/u), matching(/b$/u)]);

    it('validates through every rule as a Standard Schema', () => {
      expect(chain['~standard'].validate('ab')).toStrictEqual({ value: 'ab' });
      expect(chain['~standard'].validate('a').issues).toHaveLength(1);
    });

    it('accepts anything when it holds no rules', () => {
      expect(new ChainSchema([])['~standard'].validate(42)).toStrictEqual({ value: 42 });
    });
  });

  describe('hierarchy', () => {
    it('finds no rules on the root', () => {
      expect(rulesOf(Root, Root)).toStrictEqual([]);
    });

    it('finds no level on a class made without one', () => {
      expect(levelOf(Root, Plain)).toStrictEqual({ base: undefined, keys: [] });
    });
  });
});

const chainOf = (...patterns: RegExp[]): ChainSchema =>
  new ChainSchema(patterns.map((pattern) => matching(pattern)));

describe('folding neighbouring patterns', () => {
  it.each([
    [[/^SKU-\d{4}$/u, /^SKU-9/u], 'SKU-9001', true],
    [[/^SKU-\d{4}$/u, /^SKU-9/u], 'SKU-8001', false],
    [[/^SKU-\d{4}$/u, /9/u], 'SKU-8901', true],
    [[/^SKU-\d{4}$/u, /^x|9$/u], 'SKU-8009', true],
    [[/^SKU-\d{4}$/u, /^x|9$/u], 'SKU-8001', false],
    [[/^a/u, /^b/u], 'ab', false],
  ])('treats %o on %s as the separate patterns would', (patterns, text, expected) => {
    const separate = patterns.every((pattern) => pattern.test(text));

    expect(separate).toBe(expected);
    expect(chainOf(...patterns)['~standard'].validate(text).issues === undefined).toBe(expected);
  });

  it('keeps patterns with different flags apart', () => {
    const chain = new ChainSchema([matching(/^a/), matching(/^ab/u)]);

    expect(chain.plan).toHaveLength(2);
    expect(chain['~standard'].validate('abc')).toStrictEqual({ value: 'abc' });
    expect(chain['~standard'].validate('ac').issues).toHaveLength(1);
  });

  it('reports the rule that failed, not the folded expression', () => {
    expect(chainOf(/^SKU-\d{4}$/u, /^SKU-9/u)['~standard'].validate('SKU-8001')).toStrictEqual({
      issues: [{ message: 'must be matched by ^SKU-9 (was "SKU-8001")' }],
    });
  });
});

describe('a chain holding a schema from another library', () => {
  const trimmed = type('string').pipe((text) => text.trim());
  const chain = new ChainSchema([trimmed, matching(/^ab$/u)]);

  it('builds no flat plan', () => {
    expect(chain.plan).toBeUndefined();
  });

  it('passes each rule the value the previous one produced', () => {
    expect(chain['~standard'].validate('  ab  ')).toStrictEqual({ value: 'ab' });
  });
});
