import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { Integer } from './integer.ts';
import { integerBetween } from './number-rule.ts';

const Int32Base: SubtypeOf<typeof Integer, 'nominal.Int32'> = Integer.subtype(
  'nominal.Int32',
  integerBetween(-2147483648, 2147483647, 'a signed 32-bit integer', {
    format: 'int32',
  }),
);

/**
 * An integer from -2147483648 to 2147483647, the range of a signed 32-bit integer.
 */
export class Int32 extends Int32Base {
  declare public static readonly '~standard': StandardOf<typeof Int32>;
}
