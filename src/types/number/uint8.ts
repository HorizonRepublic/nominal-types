import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { Integer } from './integer.ts';

const inRange = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 255;

const Uint8Base: SubtypeOf<typeof Integer, 'Uint8'> = Integer.subtype(
  'Uint8',
  satisfying(inRange, 'an unsigned 8-bit integer', { type: 'integer', minimum: 0, maximum: 255 }),
);

/**
 * An integer from 0 to 255, the range of an unsigned 8-bit integer.
 */
export class Uint8 extends Uint8Base {}
