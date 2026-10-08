import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  Integer,
  n,
  Nominal,
  NonBlankString,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
} from '../../src/index.ts';
import type { NonNegativeNumber } from '../../src/index.ts';

const atLeastTen = n.satisfying(
  (value: unknown): value is number => typeof value === 'number' && value >= 10,
  'at least 10',
);

const isOdd = n.satisfying(
  (value: unknown): value is number => typeof value === 'number' && value % 2 === 1,
  'an odd number',
);

const isEven = n.satisfying(
  (value: unknown): value is number => typeof value === 'number' && value % 2 === 0,
  'an even number',
);

class Score extends Integer.subtype(
  'implies.Score',
  n.satisfying(
    (value: unknown): value is number => typeof value === 'number' && value >= 0,
    'a score',
  ),
  { implies: [NonNegativeInteger] },
) {}

class Quantity extends Integer.subtype('implies.Quantity', isEven, {
  implies: [PositiveInteger],
}) {}

class Code extends Nominal('implies.Code', /^[A-Z]{3}$/u, { implies: [NonBlankString] }) {}

const takeNonNegative = (value: NonNegativeInteger): number => value.value;
const takePositiveNumber = (value: PositiveNumber): number => value.value;

describe('a type that implies another, at compile time', () => {
  it('passes where the implied type is expected', () => {
    expect(takeNonNegative(new Score(3))).toBe(3);
    expect(takePositiveNumber(new Quantity(2))).toBe(2);
    expectTypeOf<Score>().toExtend<NonNegativeInteger>();
    expectTypeOf<Score>().toExtend<NonNegativeNumber>();
    expectTypeOf<Quantity>().toExtend<PositiveNumber>();
    expectTypeOf<Code>().toExtend<NonBlankString>();
  });

  it('never lets the implied type pass for it', () => {
    const takeScore = (value: Score): number => value.value;

    // @ts-expect-error a NonNegativeInteger is not a Score
    takeScore(new NonNegativeInteger(3));

    expectTypeOf<NonNegativeInteger>().not.toExtend<Score>();
    expectTypeOf<NonBlankString>().not.toExtend<Code>();
  });

  it('drops the implied brands in a variant', () => {
    class Signed extends Score.variant('implies.SignedType', isEven) {}

    expectTypeOf<Signed>().not.toExtend<NonNegativeInteger>();
    expectTypeOf<Signed>().not.toExtend<Score>();
    expectTypeOf<Signed>().toExtend<Integer>();
  });

  it('keeps the brands a level above implies in a variant', () => {
    class Small extends Integer.subtype('implies.SmallType', undefined, {
      implies: [NonNegativeInteger],
    }) {}
    class Smaller extends Small.subtype('implies.SmallerType', isEven, {
      implies: [PositiveNumber],
    }) {}
    class Odd extends Smaller.variant('implies.OddType', isOdd) {}

    expectTypeOf<Odd>().toExtend<NonNegativeInteger>();
    expectTypeOf<Odd>().not.toExtend<PositiveNumber>();
  });

  it('keeps the brands a variant implies of its own', () => {
    class Large extends Score.variant('implies.LargeType', atLeastTen, { implies: [Score] }) {}

    expectTypeOf<Large>().toExtend<Score>();
    expectTypeOf<Large>().toExtend<NonNegativeInteger>();
  });
});
