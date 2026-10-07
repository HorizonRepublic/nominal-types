import { describe, expect, it } from 'vitest';

import { compileSteps } from '../../src/core/compile.ts';
import type { Step } from '../../src/core/plan.ts';

const step = (accepts: (value: unknown) => boolean): Step => ({ accepts, issues: () => [] });

const steps = [
  step((value) => typeof value === 'number'),
  step((value) => Number.isInteger(value)),
  step((value) => typeof value === 'number' && value > 0),
];

describe.each([
  ['generated', true],
  ['looped', false],
])('a %s plan', (_, generate) => {
  const failing = compileSteps(steps, generate);

  it.each([
    [3, -1],
    ['3', 0],
    [1.5, 1],
    [-2, 2],
  ])('answers %s with the index %d', (value, index) => {
    expect(failing(value)).toBe(index);
  });

  it('accepts anything with no steps', () => {
    expect(compileSteps([], generate)('anything')).toBe(-1);
  });
});
