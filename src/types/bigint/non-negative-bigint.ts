import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyBigInt } from './any-bigint.ts';
import { bigintRule } from './bigint-rule.ts';

const NonNegativeBigIntBase: SubtypeOf<typeof AnyBigInt, 'nominal.NonNegativeBigInt'> =
  AnyBigInt.subtype(
    'nominal.NonNegativeBigInt',
    bigintRule('a non-negative integer', (value) => value >= 0n, {
      string: { type: 'string', pattern: '^(?:0|[1-9]\\d*)$' },
      integer: { type: 'integer', minimum: 0 },
      examples: ['9007199254740993'],
    }),
  );

/**
 * A bigint from 0 up.
 *
 * @remarks
 * Unlike `PositiveBigInt`, it takes 0.
 *
 * @example
 * ```ts
 * import { NonNegativeBigInt } from '@horizon-republic/nominal-types';
 *
 * new NonNegativeBigInt('0').value; // 0n
 * NonNegativeBigInt.parse(-1n).ok; // false
 * ```
 */
export class NonNegativeBigInt extends NonNegativeBigIntBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof NonNegativeBigInt>;
}
