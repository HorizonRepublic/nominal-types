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
 */
export class Uint8 extends Uint8Base {
  declare public static readonly '~standard': StandardOf<typeof Uint8>;
}
