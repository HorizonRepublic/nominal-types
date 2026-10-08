import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { Integer } from './integer.ts';
import { NonPositiveNumber } from './non-positive-number.ts';
import { numberRule } from './number-rule.ts';

const NonPositiveIntegerBase: SubtypeOf<
  typeof Integer,
  'nominal.NonPositiveInteger',
  number,
  typeof NonPositiveNumber
> = Integer.subtype(
  'nominal.NonPositiveInteger',
  numberRule('a non-positive integer', (value) => value <= 0, { type: 'integer', maximum: 0 }),
  { implies: [NonPositiveNumber] },
);

/**
 * A safe integer from 0 down.
 *
 * @remarks
 * Unlike `NegativeInteger`, it takes 0 and `-0`.
 *
 * @example
 * ```ts
 * import { NonPositiveInteger } from '@horizon-republic/nominal-types';
 *
 * new NonPositiveInteger(0).value; // 0
 * NonPositiveInteger.parse(1).ok; // false
 * ```
 */
export class NonPositiveInteger extends NonPositiveIntegerBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof NonPositiveInteger>;
}
