import type { SubtypeOf } from '../../core/contracts.ts';
import { Int16 } from './int16.ts';
import { Integer } from './integer.ts';
import { integerBetween } from './number-rule.ts';

const Int8Base: SubtypeOf<typeof Integer, 'nominal.Int8', number, typeof Int16> = Integer.subtype(
  'nominal.Int8',
  integerBetween(-128, 127, 'a signed 8-bit integer'),
  { implies: [Int16] },
);

/**
 * An integer from -128 to 127, the range of a signed 8-bit integer.
 */
export class Int8 extends Int8Base {}
