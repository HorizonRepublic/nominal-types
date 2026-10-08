import { describe, expect, it } from 'vitest';

import { brandCheck, compileRun, freshCopy } from '../../src/core/compile.ts';
import type { ConvertStep, Step } from '../../src/core/plan.ts';
import { Rejection } from '../../src/core/rejection.ts';

const check = (name: string, accepts: (value: unknown) => boolean): Step => ({
  accepts,
  issues: () => [{ message: name }],
});

const trim: ConvertStep = {
  convert: (value) =>
    typeof value === 'string' ? value.trim() : new Rejection([{ message: 'not text' }]),
};

const steps = [
  check('a string', (value) => typeof value === 'string'),
  trim,
  check('not empty', (value) => value !== ''),
];

const make =
  (offset: number) =>
  (value: number): number =>
    value + offset;

const outcome = (result: unknown): unknown =>
  result instanceof Rejection ? result.issues : result;

describe.each([
  ['generated', true],
  ['looped', false],
])('a %s run', (_, generate) => {
  const run = compileRun(steps, generate);

  it.each([
    ['  abc  ', 'abc'],
    [42, [{ message: 'a string' }]],
    ['   ', [{ message: 'not empty' }]],
  ])('answers %j with %j', (input, expected) => {
    expect(outcome(run(input))).toStrictEqual(expected);
  });

  it('stops at a mapping step that rejects', () => {
    expect(outcome(compileRun([trim, check('never', () => false)], generate)(1))).toStrictEqual([
      { message: 'not text' },
    ]);
  });

  it('reports a check after a mapping step about the input as given', () => {
    const shown: Step = {
      accepts: (value) => value !== '',
      issues: (value, input) => [
        { message: `${JSON.stringify(value)} from ${JSON.stringify(input)}` },
      ],
    };

    expect(outcome(compileRun([trim, shown], generate)('   '))).toStrictEqual([
      { message: '"" from "   "' },
    ]);
  });

  it('returns the value with no steps', () => {
    expect(compileRun([], generate)('anything')).toBe('anything');
  });
});

describe.each([
  ['generated', true],
  ['plain', false],
])('a %s brand check', (_, generate) => {
  const key = Symbol('brand');
  const isBranded = brandCheck(key, generate);

  it.each([
    [{ [key]: true }, true],
    [{ [key]: false }, false],
    [{}, false],
    [null, false],
    ['text', false],
  ])('answers %o with %s', (value, expected) => {
    expect(isBranded(value)).toBe(expected);
  });
});

describe('freshCopy()', () => {
  it('compiles the function again, so its copy is another function that does the same', () => {
    const copy = freshCopy(make, true);

    expect(copy).not.toBe(make);
    expect(copy(2)(3)).toBe(5);
  });

  it('gives the function itself without code generation', () => {
    expect(freshCopy(make, false)).toBe(make);
  });
});
