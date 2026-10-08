import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { FiniteNumber } from './finite-number.ts';
import { NonPositiveNumber } from './non-positive-number.ts';
import { numberRule } from './number-rule.ts';

const NegativeNumberBase: SubtypeOf<
  typeof FiniteNumber,
  'nominal.NegativeNumber',
  number,
  typeof NonPositiveNumber
> = FiniteNumber.subtype(
  'nominal.NegativeNumber',
  numberRule('a negative number', (value) => value < 0, { type: 'number', exclusiveMaximum: 0 }),
  { implies: [NonPositiveNumber] },
);

/**
 * A finite number below 0, for values that only ever go down, such as a write-off.
 *
 * @remarks
 * Zero is not negative, `-0` included; reach for `NonPositiveNumber` where 0 is a valid value.
 *
 * @example
 * ```ts
 * import { NegativeNumber } from '@horizon-republic/nominal-types';
 *
 * new NegativeNumber(-12.5).value; // -12.5
 * NegativeNumber.parse(0).ok; // false
 * ```
 */
export class NegativeNumber extends NegativeNumberBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof NegativeNumber>;
}
