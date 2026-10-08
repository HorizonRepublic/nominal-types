import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { Integer } from './integer.ts';
import { NonNegativeInteger } from './non-negative-integer.ts';
import { integerBetween } from './number-rule.ts';

const Uint32Base: SubtypeOf<typeof Integer, 'nominal.Uint32', number, typeof NonNegativeInteger> =
  Integer.subtype('nominal.Uint32', integerBetween(0, 4294967295, 'an unsigned 32-bit integer'), {
    implies: [NonNegativeInteger],
  });

/**
 * An integer from 0 to 4294967295, the range of an unsigned 32-bit integer.
 *
 * @example
 * ```ts
 * import { Uint32 } from '@horizon-republic/nominal-types';
 *
 * new Uint32(4294967295).value; // 4294967295
 * Uint32.parse(-1).ok; // false
 * ```
 */
export class Uint32 extends Uint32Base {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof Uint32>;
}
