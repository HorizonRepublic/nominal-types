import type { SubtypeOf } from '../../core/contracts.ts';
import { Integer } from './integer.ts';
import { integerBetween } from './number-rule.ts';

const Uint8Base: SubtypeOf<typeof Integer, 'nominal.Uint8'> = Integer.subtype(
  'nominal.Uint8',
  integerBetween(0, 255, 'an unsigned 8-bit integer'),
);

/**
 * An integer from 0 to 255, the range of an unsigned 8-bit integer.
 */
export class Uint8 extends Uint8Base {}
