import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { FiniteNumber } from './finite-number.ts';
import { numberRule } from './number-rule.ts';

const NonNegativeNumberBase: SubtypeOf<typeof FiniteNumber, 'nominal.NonNegativeNumber'> =
  FiniteNumber.subtype(
    'nominal.NonNegativeNumber',
    numberRule('a non-negative number', (value) => value >= 0, { type: 'number', minimum: 0 }),
  );

/**
 * A finite number from 0 up, for measures that may be zero, such as a balance or a distance.
 *
 * @remarks
 * Unlike `PositiveNumber`, it takes 0. `-0` passes and stays `-0`; `equals` compares with
 * `Object.is`, so it differs from `0`.
 *
 * @example
 * ```ts
 * import { NonNegativeNumber } from '@horizon-republic/nominal-types';
 *
 * new NonNegativeNumber(0).value; // 0
 * NonNegativeNumber.parse(-0.5).ok; // false
 * ```
 */
export class NonNegativeNumber extends NonNegativeNumberBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof NonNegativeNumber>;
}
