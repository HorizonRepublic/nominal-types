import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { Int8, n, Uuid } from '../../src/index.ts';
import type { NominalTarget } from '../../src/index.ts';
import { arbitraryOf } from '../../src/testing/index.ts';

const many = (target: NominalTarget, count: number): unknown[] =>
  fc.sample(arbitraryOf(target), { numRuns: count, seed: 5 });

const distinct = n.rule((items: readonly Int8[], report) => {
  items.forEach((item, index) => {
    if (items.findIndex((other) => other.value === item.value) !== index) {
      report({ path: [index], code: 'repeated' });
    }
  });
});

const ordered = n.rule(
  ({ low, high }: { readonly low: Int8; readonly high: Int8 }) => low.value <= high.value,
);

const forwards = n.rule(([low, high]: readonly [Int8, Int8]) => low.value <= high.value);

describe('arbitraryOf() with rules', () => {
  it('makes values that keep the rules of an array, a tuple and an object', () => {
    const Distinct = n.of(Int8).array({ min: 2, max: 5 }).check(distinct);
    const Range = n.tuple([Int8, Int8]).check(forwards);
    const Pair = n.object({ low: Int8, high: Int8 }).check(ordered);

    expect(many(Distinct, 200).filter((value) => !Distinct.parse(value).ok)).toStrictEqual([]);
    expect(many(Range, 200).filter((value) => !Range.parse(value).ok)).toStrictEqual([]);
    expect(many(Pair, 200).filter((value) => !Pair.parse(value).ok)).toStrictEqual([]);
  });

  it('fails clearly when a rule refuses almost everything', () => {
    const Rare = n
      .of(Uuid)
      .array()
      .check(() => false);

    expect(() => fc.sample(arbitraryOf(Rare), 1)).toThrow(
      'arbitraryOf(): n.of(nominal.Uuid).array() refused 1000 generated values in a row',
    );
  });
});
