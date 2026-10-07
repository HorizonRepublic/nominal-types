import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { compileRun } from '../../src/core/compile.ts';
import type { NominalSchema } from '../../src/core/contracts.ts';
import { foreignRunner } from '../../src/core/foreign-runner.ts';
import { levelOf, rulesOf } from '../../src/core/hierarchy.ts';
import { stepsOf } from '../../src/core/plan.ts';
import { Rejection } from '../../src/core/rejection.ts';
import { describeRules } from '../../src/core/rules-json.ts';
import { matching } from '../../src/index.ts';

class Root {}
class Plain extends Root {}

const stepsFor = (rules: readonly NominalSchema[]): ReturnType<typeof stepsOf> =>
  stepsOf(rules, (rule) => ({ convert: foreignRunner(rule, 'Probe') }));

const runOf =
  (...rules: NominalSchema[]) =>
  (input: unknown): unknown => {
    const result = compileRun(stepsFor(rules))(input);

    return result instanceof Rejection ? { issues: result.issues } : { value: result };
  };

const patterns = (...list: RegExp[]): NominalSchema[] => list.map((pattern) => matching(pattern));

describe('hierarchy', () => {
  it('finds no rules on the root', () => {
    expect(rulesOf(Root, Root)).toStrictEqual([]);
  });

  it('finds no level on a class made without one', () => {
    expect(levelOf(Root, Plain)).toStrictEqual({ base: undefined, keys: [] });
  });
});

describe('folding neighbouring patterns', () => {
  it.each([
    [[/^SKU-\d{4}$/u, /^SKU-9/u], 'SKU-9001'],
    [[/^SKU-\d{4}$/u, /9/u], 'SKU-8901'],
    [[/^SKU-\d{4}$/u, /^x|9$/u], 'SKU-8009'],
  ])('accepts what the separate patterns %o accept: %s', (list, text) => {
    expect(list.every((pattern) => pattern.test(text))).toBe(true);
    expect(runOf(...patterns(...list))(text)).toStrictEqual({ value: text });
  });

  it.each([
    [[/^SKU-\d{4}$/u, /^SKU-9/u], 'SKU-8001'],
    [[/^SKU-\d{4}$/u, /^x|9$/u], 'SKU-8001'],
    [[/^a/u, /^b/u], 'ab'],
  ])('rejects what the separate patterns %o reject: %s', (list, text) => {
    expect(list.every((pattern) => pattern.test(text))).toBe(false);
    expect(runOf(...patterns(...list))(text)).toHaveProperty('issues');
  });

  it('folds patterns that start with ^ into one step', () => {
    expect(stepsFor(patterns(/^SKU-\d{4}$/u, /^SKU-9/u))).toHaveLength(1);
    expect(stepsFor(patterns(/^SKU-\d{4}$/u, /9/u))).toHaveLength(2);
  });

  it('keeps patterns with different flags apart', () => {
    const run = runOf(matching(/^a/), matching(/^ab/u));

    expect(stepsFor([matching(/^a/), matching(/^ab/u)])).toHaveLength(2);
    expect(run('abc')).toStrictEqual({ value: 'abc' });
    expect(run('ac')).toMatchObject({ issues: [{ message: 'must be matched by ^ab (was "ac")' }] });
  });

  it('reports the rule that failed, not the folded expression', () => {
    expect(runOf(...patterns(/^SKU-\d{4}$/u, /^SKU-9/u))('SKU-8001')).toStrictEqual({
      issues: [{ message: 'must be matched by ^SKU-9 (was "SKU-8001")' }],
    });
  });

  it('accepts anything with no rules', () => {
    expect(runOf()(42)).toStrictEqual({ value: 42 });
  });
});

describe('rules from another library', () => {
  const trimmed = type('string').pipe((text) => text.trim());

  it('passes each rule the value the previous one produced', () => {
    expect(runOf(trimmed, matching(/^ab$/u))('  ab  ')).toStrictEqual({ value: 'ab' });
  });

  it('turns their issues into plain ones, with plain paths', () => {
    const shaped = {
      '~standard': {
        version: 1 as const,
        vendor: 'probe',
        validate: () => ({
          issues: [
            { message: 'bad', path: [{ key: 'a' }, 0] },
            { message: 'worse', path: [] },
          ],
        }),
      },
    };

    expect(runOf(shaped)('x')).toStrictEqual({
      issues: [{ message: 'bad', path: ['a', 0] }, { message: 'worse' }],
    });
  });

  it('refuses an asynchronous answer, naming the type', () => {
    const later = {
      '~standard': {
        version: 1 as const,
        vendor: 'probe',
        validate: () => Promise.resolve({ value: 'x' }),
      },
    };

    expect(() => runOf(later)('x')).toThrow('Probe: asynchronous schemas are not supported');
  });
});

describe('JSON Schema of several rules', () => {
  it('is an allOf with one $schema at the top', () => {
    expect(
      describeRules('Probe', patterns(/^a/u, /b$/u), 'input', { target: 'draft-07' }),
    ).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      allOf: [
        { type: 'string', pattern: '^a' },
        { type: 'string', pattern: 'b$' },
      ],
    });
  });

  it('is an empty allOf with no rules', () => {
    expect(describeRules('Probe', [], 'input', { target: 'openapi-3.0' })).toStrictEqual({
      allOf: [],
    });
  });
});
