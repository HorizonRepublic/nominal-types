import type { SubtypeOf } from '../../core/contracts.ts';
import { Integer } from './integer.ts';
import { integerBetween } from './number-rule.ts';

const Uint16Base: SubtypeOf<typeof Integer, 'nominal.Uint16'> = Integer.subtype(
  'nominal.Uint16',
  integerBetween(0, 65535, 'an unsigned 16-bit integer'),
);

/**
 * An integer from 0 to 65535, the range of an unsigned 16-bit integer.
 */
export class Uint16 extends Uint16Base {}
