import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyBigInt } from './any-bigint.ts';
import { bigintRule } from './bigint-rule.ts';
import { NonNegativeBigInt } from './non-negative-bigint.ts';

const PositiveBigIntBase: SubtypeOf<
  typeof AnyBigInt,
  'nominal.PositiveBigInt',
  bigint,
  typeof NonNegativeBigInt
> = AnyBigInt.subtype(
  'nominal.PositiveBigInt',
  bigintRule('a positive integer', (value) => value > 0n, {
    string: { type: 'string', pattern: '^[1-9]\\d*$' },
    integer: { type: 'integer', minimum: 1 },
    examples: ['9007199254740993'],
  }),
  { implies: [NonNegativeBigInt] },
);

/**
 * A bigint from 1 up.
 *
 * @remarks
 * Zero is not positive; reach for `NonNegativeBigInt` where 0 is a valid value.
 *
 * @example
 * ```ts
 * import { PositiveBigInt } from '@horizon-republic/nominal-types';
 *
 * new PositiveBigInt(1n).value; // 1n
 * PositiveBigInt.parse(0n).ok; // false
 * ```
 */
export class PositiveBigInt extends PositiveBigIntBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof PositiveBigInt>;
}
