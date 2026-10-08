import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { Integer } from './integer.ts';
import { NonNegativeNumber } from './non-negative-number.ts';
import { numberRule } from './number-rule.ts';

const NonNegativeIntegerBase: SubtypeOf<
  typeof Integer,
  'nominal.NonNegativeInteger',
  number,
  typeof NonNegativeNumber
> = Integer.subtype(
  'nominal.NonNegativeInteger',
  numberRule('a non-negative integer', (value) => value >= 0, { type: 'integer', minimum: 0 }),
  { implies: [NonNegativeNumber] },
);

/**
 * A safe integer from 0 up, for counts that may be zero, offsets and indexes.
 *
 * @remarks
 * Unlike `PositiveInteger`, it takes 0. `-0` passes and stays `-0`; `equals` compares with
 * `Object.is`, so it differs from `0`.
 *
 * @example
 * ```ts
 * import { NonNegativeInteger } from '@horizon-republic/nominal-types';
 *
 * new NonNegativeInteger(0).value; // 0
 * NonNegativeInteger.parse(-1).ok; // false
 * ```
 */
export class NonNegativeInteger extends NonNegativeIntegerBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof NonNegativeInteger>;
}
