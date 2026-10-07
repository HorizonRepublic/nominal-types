import type { SubtypeOf } from '../../core/contracts.ts';
import { Integer } from './integer.ts';
import { integerBetween } from './number-rule.ts';

const Int8Base: SubtypeOf<typeof Integer, 'Int8'> = Integer.subtype(
  'Int8',
  integerBetween(-128, 127, 'a signed 8-bit integer'),
);

/**
 * An integer from -128 to 127, the range of a signed 8-bit integer.
 */
export class Int8 extends Int8Base {}
