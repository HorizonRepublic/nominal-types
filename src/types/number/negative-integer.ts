import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { Integer } from './integer.ts';
import { NegativeNumber } from './negative-number.ts';
import { NonPositiveInteger } from './non-positive-integer.ts';
import { numberRule } from './number-rule.ts';

const NegativeIntegerBase: SubtypeOf<
  typeof Integer,
  'nominal.NegativeInteger',
  number,
  typeof NegativeNumber | typeof NonPositiveInteger
> = Integer.subtype(
  'nominal.NegativeInteger',
  numberRule('a negative integer', (value) => value < 0, { type: 'integer', maximum: -1 }),
  { implies: [NegativeNumber, NonPositiveInteger] },
);

/**
 * A safe integer from -1 down.
 *
 * @remarks
 * Zero is not negative; reach for `NonPositiveInteger` where 0 is a valid value.
 *
 * @example
 * ```ts
 * import { NegativeInteger } from '@horizon-republic/nominal-types';
 *
 * new NegativeInteger(-1).value; // -1
 * NegativeInteger.parse(0).ok; // false
 * ```
 */
export class NegativeInteger extends NegativeIntegerBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof NegativeInteger>;
}
