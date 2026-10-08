import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyBigInt } from './any-bigint.ts';
import { bigintRule } from './bigint-rule.ts';

const NonPositiveBigIntBase: SubtypeOf<typeof AnyBigInt, 'nominal.NonPositiveBigInt'> =
  AnyBigInt.subtype(
    'nominal.NonPositiveBigInt',
    bigintRule('a non-positive integer', (value) => value <= 0n, {
      string: { type: 'string', pattern: '^(?:0|-[1-9]\\d*)$' },
      integer: { type: 'integer', maximum: 0 },
      examples: ['-9007199254740993'],
    }),
  );

/**
 * A bigint from 0 down.
 *
 * @remarks
 * Unlike `NegativeBigInt`, it takes 0.
 *
 * @example
 * ```ts
 * import { NonPositiveBigInt } from '@horizon-republic/nominal-types';
 *
 * new NonPositiveBigInt(0).value; // 0n
 * NonPositiveBigInt.parse(1n).ok; // false
 * ```
 */
export class NonPositiveBigInt extends NonPositiveBigIntBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof NonPositiveBigInt>;
}
