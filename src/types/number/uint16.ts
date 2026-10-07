import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { Integer } from './integer.ts';

const inRange = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 65535;

const Uint16Base: SubtypeOf<typeof Integer, 'Uint16'> = Integer.subtype(
  'Uint16',
  satisfying(inRange, 'an unsigned 16-bit integer', {
    type: 'integer',
    minimum: 0,
    maximum: 65535,
  }),
);

/**
 * An integer from 0 to 65535, the range of an unsigned 16-bit integer.
 */
export class Uint16 extends Uint16Base {}
