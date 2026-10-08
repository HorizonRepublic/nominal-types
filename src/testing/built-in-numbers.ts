import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

const { MAX_SAFE_INTEGER, MIN_SAFE_INTEGER } = Number;

const finite = { noNaN: true, noDefaultInfinity: true } as const;

// `-0` passes every rule that takes 0, and integer generators never make it.
const withNegativeZero = (source: Arbitrary<number>): Arbitrary<number> =>
  fc.oneof({ arbitrary: source, weight: 20 }, { arbitrary: fc.constant(-0), weight: 1 });

const integerFrom = (min: number, max: number): Arbitrary<number> => {
  const integers = fc.integer({ min, max });

  return min <= 0 && max >= 0 ? withNegativeZero(integers) : integers;
};

const longestText = 1000;

// The largest bigint whose decimal text, sign included, fits in 1000 characters.
const widest = 10n ** BigInt(longestText - 1) - 1n;

const clamp = (value: bigint, min: bigint, max: bigint): bigint => {
  if (value < min) {
    return min;
  }

  return value > max ? max : value;
};

// Ranges from the safe integers out to the widest text, so values of every size come up, and
// the bounds of a range more often than its inside.
const widths = [2n ** 53n, 2n ** 64n, widest];

const bigintsFrom = (min: bigint, max: bigint): Arbitrary<bigint> =>
  fc.oneof(
    ...widths.map((width, index) => ({
      arbitrary: fc.bigInt({ min: clamp(-width, min, max), max: clamp(width, min, max) }),
      weight: 3 - index,
    })),
    { arbitrary: fc.constantFrom(min, max), weight: 1 },
  );

// A big integer arrives as a bigint, as its decimal text, or as a safe integer.
const bigintFrom = (min: bigint, max: bigint): Arbitrary<unknown> =>
  fc
    .tuple(bigintsFrom(min, max), fc.constantFrom('bigint', 'text', 'number'))
    .map(([value, form]) => {
      if (form === 'text') {
        return value.toString();
      }

      const number = Number(value);

      return form === 'number' && Number.isSafeInteger(number) ? number : value;
    });

/**
 * A generator for each built-in number, big integer and boolean type, by name.
 *
 * @internal
 */
export const numberArbitraries: Readonly<Record<string, () => Arbitrary<unknown>>> = {
  'nominal.AnyNumber': () => fc.double(),
  'nominal.FiniteNumber': () => fc.double(finite),
  'nominal.Float32': () => fc.float(finite),
  'nominal.Integer': () => integerFrom(MIN_SAFE_INTEGER, MAX_SAFE_INTEGER),
  'nominal.Int8': () => integerFrom(-128, 127),
  'nominal.Int16': () => integerFrom(-32_768, 32_767),
  'nominal.Int32': () => integerFrom(-2_147_483_648, 2_147_483_647),
  'nominal.Uint8': () => integerFrom(0, 255),
  'nominal.Uint16': () => integerFrom(0, 65_535),
  'nominal.Uint32': () => integerFrom(0, 4_294_967_295),
  'nominal.Port': () => integerFrom(1, 65_535),
  'nominal.PositiveInteger': () => integerFrom(1, MAX_SAFE_INTEGER),
  'nominal.NegativeInteger': () => integerFrom(MIN_SAFE_INTEGER, -1),
  'nominal.NonNegativeInteger': () => integerFrom(0, MAX_SAFE_INTEGER),
  'nominal.NonPositiveInteger': () => integerFrom(MIN_SAFE_INTEGER, 0),
  'nominal.PositiveNumber': () => fc.double({ ...finite, min: 0, minExcluded: true }),
  // fast-check orders -0 below 0, so a bound of -0 keeps or drops it as the rule does.
  'nominal.NegativeNumber': () => fc.double({ ...finite, max: -0, maxExcluded: true }),
  'nominal.NonNegativeNumber': () => fc.double({ ...finite, min: -0 }),
  'nominal.NonPositiveNumber': () => fc.double({ ...finite, max: 0 }),
  'nominal.Latitude': () => fc.double({ ...finite, min: -90, max: 90 }),
  'nominal.Longitude': () => fc.double({ ...finite, min: -180, max: 180 }),
  'nominal.AnyBigInt': () => bigintFrom(-widest, widest),
  'nominal.PositiveBigInt': () => bigintFrom(1n, widest),
  'nominal.NegativeBigInt': () => bigintFrom(-widest, -1n),
  'nominal.NonNegativeBigInt': () => bigintFrom(0n, widest),
  'nominal.NonPositiveBigInt': () => bigintFrom(-widest, 0n),
  'nominal.Int64': () => bigintFrom(-(2n ** 63n), 2n ** 63n - 1n),
  'nominal.Uint64': () => bigintFrom(0n, 2n ** 64n - 1n),
  'nominal.AnyBoolean': () => fc.boolean(),
};
