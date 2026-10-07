import type { SubtypeOf } from '../../core/contracts.ts';
import { Integer } from './integer.ts';
import { integerBetween } from './number-rule.ts';

const Uint32Base: SubtypeOf<typeof Integer, 'nominal.Uint32'> = Integer.subtype(
  'nominal.Uint32',
  integerBetween(0, 4294967295, 'an unsigned 32-bit integer'),
);

/**
 * An integer from 0 to 4294967295, the range of an unsigned 32-bit integer.
 */
export class Uint32 extends Uint32Base {}
