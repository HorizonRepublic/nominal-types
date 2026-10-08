import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { Float32 } from './float32.ts';
import { Int32 } from './int32.ts';
import { Integer } from './integer.ts';
import { integerBetween } from './number-rule.ts';
import { Uint32 } from './uint32.ts';

const Uint16Base: SubtypeOf<
  typeof Integer,
  'nominal.Uint16',
  number,
  typeof Uint32 | typeof Int32 | typeof Float32
> = Integer.subtype('nominal.Uint16', integerBetween(0, 65535, 'an unsigned 16-bit integer'), {
  implies: [Uint32, Int32, Float32],
});

/**
 * An integer from 0 to 65535, the range of an unsigned 16-bit integer.
 */
export class Uint16 extends Uint16Base {
  declare public static readonly '~standard': StandardOf<typeof Uint16>;
}
