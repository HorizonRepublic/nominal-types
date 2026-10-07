import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { Integer } from './integer.ts';

const inRange = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 4294967295;

const Uint32Base: SubtypeOf<typeof Integer, 'Uint32'> = Integer.subtype(
  'Uint32',
  satisfying(inRange, 'an unsigned 32-bit integer', {
    type: 'integer',
    minimum: 0,
    maximum: 4294967295,
  }),
);

/**
 * An integer from 0 to 4294967295, the range of an unsigned 32-bit integer.
 */
export class Uint32 extends Uint32Base {}
