import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { Int16 } from './int16.ts';
import { Integer } from './integer.ts';
import { integerBetween } from './number-rule.ts';
import { Uint16 } from './uint16.ts';

const Uint8Base: SubtypeOf<typeof Integer, 'nominal.Uint8', number, typeof Uint16 | typeof Int16> =
  Integer.subtype('nominal.Uint8', integerBetween(0, 255, 'an unsigned 8-bit integer'), {
    implies: [Uint16, Int16],
  });

/**
 * An integer from 0 to 255, the range of an unsigned 8-bit integer.
 *
 * @example
 * ```ts
 * import { Uint8 } from '@horizon-republic/nominal-types';
 *
 * new Uint8(255).value; // 255
 * Uint8.parse(256).ok; // false
 * ```
 */
export class Uint8 extends Uint8Base {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof Uint8>;
}
