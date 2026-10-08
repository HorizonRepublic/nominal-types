import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  AnyBigInt,
  AnyNumber,
  FiniteNumber,
  Float32,
  Int16,
  Int32,
  Int64,
  Int8,
  Integer,
  Latitude,
  Longitude,
  NegativeBigInt,
  NegativeInteger,
  NegativeNumber,
  NonNegativeBigInt,
  NonNegativeInteger,
  NonNegativeNumber,
  NonPositiveBigInt,
  NonPositiveInteger,
  NonPositiveNumber,
  Port,
  PositiveBigInt,
  PositiveInteger,
  PositiveNumber,
  Uint16,
  Uint32,
  Uint64,
  Uint8,
} from '../../src/index.ts';
import type { AnyNominalType } from '../../src/index.ts';
import { valueOf } from '../support/results.ts';
import { edgeSamples, rangeSamples, sampleTypes } from '../support/samples.ts';

// Every type a built-in implies besides the types above it, written out in full.
const implications = new Map<AnyNominalType, readonly AnyNominalType[]>([
  [AnyNumber, []],
  [FiniteNumber, []],
  [PositiveNumber, [NonNegativeNumber]],
  [NegativeNumber, [NonPositiveNumber]],
  [NonNegativeNumber, []],
  [NonPositiveNumber, []],
  [Float32, []],
  [Latitude, []],
  [Longitude, []],
  [Integer, []],
  [PositiveInteger, [PositiveNumber, NonNegativeNumber, NonNegativeInteger]],
  [NegativeInteger, [NegativeNumber, NonPositiveNumber, NonPositiveInteger]],
  [NonNegativeInteger, [NonNegativeNumber]],
  [NonPositiveInteger, [NonPositiveNumber]],
  [Int8, [Int16, Int32, Float32]],
  [Int16, [Int32, Float32]],
  [Int32, []],
  [Uint8, [Uint16, Uint32, Int16, Int32, Float32, NonNegativeInteger, NonNegativeNumber]],
  [Uint16, [Uint32, Int32, Float32, NonNegativeInteger, NonNegativeNumber]],
  [Uint32, [NonNegativeInteger, NonNegativeNumber]],
  [
    Port,
    [
      PositiveInteger,
      PositiveNumber,
      NonNegativeInteger,
      NonNegativeNumber,
      Uint32,
      Int32,
      Float32,
    ],
  ],
  [AnyBigInt, []],
  [PositiveBigInt, [NonNegativeBigInt]],
  [NegativeBigInt, [NonPositiveBigInt]],
  [NonNegativeBigInt, []],
  [NonPositiveBigInt, []],
  [Int64, []],
  [Uint64, [NonNegativeBigInt]],
]);

// Types that name a meaning rather than a range: a value in range is not one of them by chance.
const meanings = new Set<AnyNominalType>([Latitude, Longitude, Port]);

const types = [...implications.keys()];
const samples = [...edgeSamples, ...rangeSamples];

const accepted = (type: AnyNominalType): readonly unknown[] =>
  samples
    .filter((sample) => type.accepts(sample))
    .map((sample) => valueOf(type.parse(sample)).value);

const ancestorsOf = (type: AnyNominalType): readonly AnyNominalType[] =>
  types.filter((other) => other !== type && Object.prototype.isPrototypeOf.call(other, type));

const rootOf = (type: AnyNominalType): AnyNominalType =>
  type.prototype instanceof AnyBigInt ? AnyBigInt : AnyNumber;

const isNumeric = (type: AnyNominalType): boolean =>
  type.prototype instanceof AnyNumber || type.prototype instanceof AnyBigInt;

const impliedBy = (type: AnyNominalType): readonly AnyNominalType[] => implications.get(type) ?? [];

const typeNames = (list: Iterable<AnyNominalType>): readonly string[] =>
  [...list].map((type) => type.typeName).toSorted();

// The range types of the same root that the type neither extends nor implies.
const unrelatedTo = (type: AnyNominalType): readonly AnyNominalType[] =>
  types.filter(
    (other) =>
      other !== type &&
      rootOf(other) === rootOf(type) &&
      !meanings.has(other) &&
      !impliedBy(type).includes(other) &&
      !ancestorsOf(type).includes(other),
  );

const instanceOf = (type: AnyNominalType): AnyNominalType['prototype'] =>
  valueOf(type.parse(accepted(type)[0]));

describe('implications of the built-in types', () => {
  it('lists every number and bigint type', () => {
    expect(new Set(sampleTypes.filter((type) => isNumeric(type)))).toStrictEqual(new Set(types));
  });

  it.each(types.map((type) => [type.typeName, type] as const))(
    '%s has a sample it accepts',
    (_, type) => {
      expect(accepted(type).length).toBeGreaterThan(0);
    },
  );

  describe.each(types.map((type) => [type.typeName, type] as const))('%s', (_, type) => {
    const implied = impliedBy(type);

    it('is an instance of exactly the types above it and the types it implies', () => {
      const instance = instanceOf(type);

      expect(typeNames(sampleTypes.filter((other) => instance instanceof other))).toStrictEqual(
        typeNames(new Set([type, ...ancestorsOf(type), ...implied])),
      );
    });

    it.each(implied.map((other) => [other.typeName, other] as const))(
      'gives %s every value it accepts',
      (__, other) => {
        expect(accepted(type).filter((value) => !other.accepts(value))).toStrictEqual([]);
      },
    );

    it("has a value outside each range type it doesn't imply", () => {
      const covered = unrelatedTo(type).filter((other) =>
        accepted(type).every((value) => other.accepts(value)),
      );

      expect(typeNames(covered)).toStrictEqual([]);
    });

    it('parses an instance into each type it implies, as an instance of that type', () => {
      const instance = instanceOf(type);

      for (const other of implied) {
        const parsed = valueOf(other.parse(instance));

        expect(parsed.constructor).toBe(other);
        expect(parsed.value).toBe(instance.value);
        expect(parsed.equals(instance)).toBe(true);
        expect(instance.equals(parsed)).toBe(true);
      }
    });
  });

  it('holds for instances built by another copy of the package', async () => {
    vi.resetModules();
    const copy = await import('../../src/index.ts');
    const port = new copy.Port(8080);

    expect(port).toBeInstanceOf(PositiveInteger);
    expect(port).toBeInstanceOf(NonNegativeNumber);
    expect(port).not.toBeInstanceOf(Int16);

    const parsed = valueOf(PositiveNumber.parse(port));

    expect(parsed.constructor).toBe(PositiveNumber);
    expect(parsed.equals(port)).toBe(true);
  });
});

describe('implications at compile time', () => {
  it('lets a type pass where a type it implies is expected', () => {
    expectTypeOf<PositiveNumber>().toExtend<NonNegativeNumber>();
    expectTypeOf<NegativeNumber>().toExtend<NonPositiveNumber>();
    expectTypeOf<PositiveInteger>().toExtend<PositiveNumber>();
    expectTypeOf<PositiveInteger>().toExtend<NonNegativeNumber>();
    expectTypeOf<PositiveInteger>().toExtend<NonNegativeInteger>();
    expectTypeOf<NegativeInteger>().toExtend<NegativeNumber>();
    expectTypeOf<NegativeInteger>().toExtend<NonPositiveNumber>();
    expectTypeOf<NegativeInteger>().toExtend<NonPositiveInteger>();
    expectTypeOf<NonNegativeInteger>().toExtend<NonNegativeNumber>();
    expectTypeOf<NonPositiveInteger>().toExtend<NonPositiveNumber>();
    expectTypeOf<Int8>().toExtend<Int16>();
    expectTypeOf<Int8>().toExtend<Int32>();
    expectTypeOf<Int8>().toExtend<Float32>();
    expectTypeOf<Int16>().toExtend<Int32>();
    expectTypeOf<Int16>().toExtend<Float32>();
    expectTypeOf<Uint8>().toExtend<Uint16>();
    expectTypeOf<Uint8>().toExtend<Uint32>();
    expectTypeOf<Uint8>().toExtend<Int16>();
    expectTypeOf<Uint8>().toExtend<Int32>();
    expectTypeOf<Uint8>().toExtend<Float32>();
    expectTypeOf<Uint8>().toExtend<NonNegativeInteger>();
    expectTypeOf<Uint8>().toExtend<NonNegativeNumber>();
    expectTypeOf<Uint16>().toExtend<Uint32>();
    expectTypeOf<Uint16>().toExtend<Int32>();
    expectTypeOf<Uint16>().toExtend<Float32>();
    expectTypeOf<Uint16>().toExtend<NonNegativeInteger>();
    expectTypeOf<Uint16>().toExtend<NonNegativeNumber>();
    expectTypeOf<Uint32>().toExtend<NonNegativeInteger>();
    expectTypeOf<Uint32>().toExtend<NonNegativeNumber>();
    expectTypeOf<Port>().toExtend<PositiveInteger>();
    expectTypeOf<Port>().toExtend<PositiveNumber>();
    expectTypeOf<Port>().toExtend<NonNegativeInteger>();
    expectTypeOf<Port>().toExtend<NonNegativeNumber>();
    expectTypeOf<Port>().toExtend<Uint32>();
    expectTypeOf<Port>().toExtend<Int32>();
    expectTypeOf<Port>().toExtend<Float32>();
    expectTypeOf<PositiveBigInt>().toExtend<NonNegativeBigInt>();
    expectTypeOf<NegativeBigInt>().toExtend<NonPositiveBigInt>();
    expectTypeOf<Uint64>().toExtend<NonNegativeBigInt>();
  });

  it('never lets the wider type pass where the narrower one is expected', () => {
    expectTypeOf<NonNegativeNumber>().not.toExtend<PositiveNumber>();
    expectTypeOf<NonPositiveNumber>().not.toExtend<NegativeNumber>();
    expectTypeOf<PositiveNumber>().not.toExtend<PositiveInteger>();
    expectTypeOf<NonNegativeInteger>().not.toExtend<PositiveInteger>();
    expectTypeOf<NegativeNumber>().not.toExtend<NegativeInteger>();
    expectTypeOf<NonPositiveInteger>().not.toExtend<NegativeInteger>();
    expectTypeOf<NonNegativeNumber>().not.toExtend<NonNegativeInteger>();
    expectTypeOf<Int16>().not.toExtend<Int8>();
    expectTypeOf<Int32>().not.toExtend<Int16>();
    expectTypeOf<Float32>().not.toExtend<Int16>();
    expectTypeOf<Uint16>().not.toExtend<Uint8>();
    expectTypeOf<Int16>().not.toExtend<Uint8>();
    expectTypeOf<NonNegativeInteger>().not.toExtend<Uint32>();
    expectTypeOf<PositiveInteger>().not.toExtend<Port>();
    expectTypeOf<Uint32>().not.toExtend<Port>();
    expectTypeOf<NonNegativeBigInt>().not.toExtend<PositiveBigInt>();
    expectTypeOf<NonPositiveBigInt>().not.toExtend<NegativeBigInt>();
    expectTypeOf<NonNegativeBigInt>().not.toExtend<Uint64>();
  });

  it('keeps the types that imply nothing apart', () => {
    expectTypeOf<Uint8>().not.toExtend<Int8>();
    expectTypeOf<Uint32>().not.toExtend<Int32>();
    expectTypeOf<Int32>().not.toExtend<Float32>();
    expectTypeOf<Int8>().not.toExtend<Longitude>();
    expectTypeOf<Latitude>().not.toExtend<Longitude>();
    expectTypeOf<Int64>().not.toExtend<NonNegativeBigInt>();
    expectTypeOf<PositiveBigInt>().not.toExtend<Int64>();
  });
});
