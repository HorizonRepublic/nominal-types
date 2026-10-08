import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { Float32 } from './float32.ts';
import { Int32 } from './int32.ts';
import { Integer } from './integer.ts';
import { integerBetween } from './number-rule.ts';

const Int16Base: SubtypeOf<typeof Integer, 'nominal.Int16', number, typeof Int32 | typeof Float32> =
  Integer.subtype('nominal.Int16', integerBetween(-32768, 32767, 'a signed 16-bit integer'), {
    implies: [Int32, Float32],
  });

/**
 * An integer from -32768 to 32767, the range of a signed 16-bit integer.
 *
 * @example
 * ```ts
 * import { Int16 } from '@horizon-republic/nominal-types';
 *
 * new Int16(32767).value; // 32767
 * Int16.parse(32768).ok; // false
 * ```
 */
export class Int16 extends Int16Base {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof Int16>;
}
