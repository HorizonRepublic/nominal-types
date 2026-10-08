import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import {
  AnyString,
  Integer,
  n,
  Nominal,
  NonBlankString,
  NonNegativeInteger,
  NonNegativeNumber,
  PositiveInteger,
  PositiveNumber,
} from '../../src/index.ts';
import { issuesOf, thrownBy, valueOf } from '../support/results.ts';

type Library = typeof library;

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

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

describe('a type that implies another', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('instanceof', () => {
    it('is an instance of the types it implies', () => {
      expect(new Score(3)).toBeInstanceOf(NonNegativeInteger);
      expect(new Score(3)).toBeInstanceOf(Integer);
    });

    it('is an instance of what those types imply', () => {
      expect(new Score(3)).toBeInstanceOf(NonNegativeNumber);
      expect(new Quantity(2)).toBeInstanceOf(PositiveNumber);
      expect(new Quantity(2)).toBeInstanceOf(NonNegativeInteger);
    });

    it('does not make the implied type an instance of it', () => {
      expect(new NonNegativeInteger(3)).not.toBeInstanceOf(Score);
    });

    it('works on a type declared with Nominal()', () => {
      expect(new Code('ABC')).toBeInstanceOf(NonBlankString);
      expect(new Code('ABC')).toBeInstanceOf(AnyString);
    });

    it('is kept by a class that extends the type', () => {
      class Points extends Score {}

      expect(new Points(1)).toBeInstanceOf(NonNegativeInteger);
    });

    it('is kept by a subtype of the type', () => {
      class Bonus extends Score.subtype('implies.Bonus', isEven) {}

      expect(new Bonus(2)).toBeInstanceOf(NonNegativeInteger);
    });
  });

  describe('parse() of the implied type', () => {
    it('returns an instance of its own, with the same value', () => {
      const score = new Score(3);
      const parsed = valueOf(NonNegativeInteger.parse(score));

      expect(parsed).not.toBe(score);
      expect(parsed.constructor).toBe(NonNegativeInteger);
      expect(parsed.value).toBe(3);
    });

    it('checks the value again, so a wrong declaration lets no value through', () => {
      class Liar extends Integer.subtype('implies.Liar', undefined, {
        implies: [PositiveNumber],
      }) {}

      const liar = new Liar(-1);

      expect(liar).toBeInstanceOf(PositiveNumber);
      expect(issuesOf(PositiveNumber.parse(liar))).toStrictEqual([
        { message: 'must be a positive number (was -1)' },
      ]);
      expect(PositiveNumber.accepts(liar)).toBe(false);
    });

    it('checks the value of an instance whose value was changed', () => {
      const score = new Score(3);

      Reflect.set(score, 'value', -3);

      expect(NonNegativeInteger.parse(score).ok).toBe(false);
      expect(NonNegativeInteger.accepts(score)).toBe(false);
    });

    it('keeps an instance of its own as it is', () => {
      const score = new Score(3);

      expect(valueOf(Score.parse(score))).toBe(score);
    });
  });

  describe('equals()', () => {
    it('finds the same value in either direction', () => {
      expect(new Score(3).equals(new NonNegativeInteger(3))).toBe(true);
      expect(new NonNegativeInteger(3).equals(new Score(3))).toBe(true);
      expect(new Score(3).equals(new NonNegativeInteger(4))).toBe(false);
    });

    it('tells apart a type it does not imply', () => {
      expect(new Score(3).equals(new PositiveInteger(3))).toBe(false);
    });
  });

  describe('variants', () => {
    it('drop the implications of the level they replace', () => {
      class Signed extends Score.variant('implies.Signed', isEven) {}

      const signed = new Signed(-2);

      expect(signed).not.toBeInstanceOf(Score);
      expect(signed).not.toBeInstanceOf(NonNegativeInteger);
      expect(signed).not.toBeInstanceOf(NonNegativeNumber);
      expect(signed).toBeInstanceOf(Integer);
    });

    it('keep the implications of the levels above', () => {
      class Small extends Integer.subtype('implies.Small', undefined, {
        implies: [NonNegativeInteger],
      }) {}
      class Smaller extends Small.subtype('implies.Smaller', isEven, {
        implies: [PositiveNumber],
      }) {}
      class Odd extends Smaller.variant('implies.Odd', isOdd) {}

      const odd = new Odd(1);

      expect(odd).toBeInstanceOf(Small);
      expect(odd).toBeInstanceOf(NonNegativeInteger);
      expect(odd).toBeInstanceOf(NonNegativeNumber);
      expect(odd).not.toBeInstanceOf(PositiveNumber);
      expect(odd).not.toBeInstanceOf(Smaller);
    });

    it('may imply types of their own', () => {
      class Large extends Score.variant('implies.Large', atLeastTen, { implies: [Score] }) {}

      expect(new Large(12)).toBeInstanceOf(Score);
      expect(new Large(12)).toBeInstanceOf(NonNegativeInteger);
    });
  });

  describe('declaration', () => {
    it('refuses a value that is not a nominal type', () => {
      // @ts-expect-error Number is not a nominal type
      expect(() => Integer.subtype('implies.Wrong', undefined, { implies: [Number] })).toThrow(
        new TypeError('implies.Wrong: implies takes nominal types'),
      );
    });

    it('refuses a type whose instances have members the new type lacks', () => {
      class Celsius extends Integer.subtype('implies.Celsius') {
        public get kelvin(): number {
          return this.value + 273;
        }
      }

      expect(
        thrownBy(() => Integer.subtype('implies.Reading', undefined, { implies: [Celsius] })),
      ).toStrictEqual(
        new TypeError('implies.Reading: cannot imply implies.Celsius, whose instances have kelvin'),
      );
    });

    it('takes a type with members the new type has too', () => {
      class Degrees extends Integer.subtype('implies.Degrees') {
        public get kelvin(): number {
          return this.value + 273;
        }
      }
      class Warm extends Degrees.subtype('implies.Warm', isEven) {}
      class Hot extends Degrees.subtype('implies.Hot', isEven, { implies: [Warm] }) {}

      expect(new Hot(40)).toBeInstanceOf(Warm);
      expect(new Hot(40).kelvin).toBe(313);
    });

    it('counts the implied types in the signature of a name declared twice', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      Integer.subtype('implies.Twice', undefined, { implies: [NonNegativeInteger] });
      Integer.subtype('implies.Twice', undefined, { implies: [NonNegativeInteger] });

      expect(warn).not.toHaveBeenCalled();

      Integer.subtype('implies.Twice', undefined, { implies: [PositiveInteger] });

      expect(warn).toHaveBeenCalledOnce();
    });
  });

  describe('another copy of the package', () => {
    it('sees the implications of its instances', async () => {
      const copy = await anotherCopy();
      const score = new copy.PositiveInteger(3);

      expect(score).toBeInstanceOf(PositiveNumber);
      expect(valueOf(PositiveNumber.parse(score)).constructor).toBe(PositiveNumber);
      expect(new PositiveNumber(3).equals(score)).toBe(true);
    });

    it('can be implied by a type of this copy', async () => {
      const copy = await anotherCopy();
      const Count = Integer.subtype('implies.Count', undefined, {
        implies: [copy.NonNegativeInteger],
      });

      expect(new Count(-1)).toBeInstanceOf(copy.NonNegativeInteger);
      expect(new Count(-1)).toBeInstanceOf(NonNegativeInteger);
      expect(copy.NonNegativeInteger.parse(new Count(-1)).ok).toBe(false);
    });
  });
});
