import { describe, expect, it } from 'vitest';

import { Rejection } from '../../src/core/rejection.ts';
import { arrayShape } from '../../src/core/shapes.ts';

describe('the array loop without code generation', () => {
  const item = {
    run: (value: unknown): unknown =>
      typeof value === 'number' ? value : new Rejection([{ message: 'a number' }]),
    describe: () => ({}),
  };

  it.each([true, false])('agrees with the generated one, generation %o', (generate) => {
    const { run } = arrayShape(item, { min: 1, max: 2 }, generate);

    expect(run([1, 2])).toStrictEqual([1, 2]);
    expect(run('x')).toStrictEqual(new Rejection([{ message: 'must be an array (was "x")' }]));
    expect(run([])).toStrictEqual(
      new Rejection([{ message: 'must have at least 1 item (was 0)' }]),
    );
    expect(run([1, 'a'])).toStrictEqual(new Rejection([{ message: 'a number', path: [1] }]));
  });
});
