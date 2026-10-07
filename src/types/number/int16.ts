import type { SubtypeOf } from '../../core/contracts.ts';
import { Integer } from './integer.ts';
import { integerBetween } from './number-rule.ts';

const Int16Base: SubtypeOf<typeof Integer, 'Int16'> = Integer.subtype(
  'Int16',
  integerBetween(-32768, 32767, 'a signed 16-bit integer'),
);

/**
 * An integer from -32768 to 32767, the range of a signed 16-bit integer.
 */
export class Int16 extends Int16Base {}
