import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { Integer } from './integer.ts';

const inRange = (value: unknown): value is number =>
  typeof value === 'number' && value >= -32768 && value <= 32767;

const Int16Base: SubtypeOf<typeof Integer, 'Int16'> = Integer.subtype(
  'Int16',
  satisfying(inRange, 'a signed 16-bit integer', {
    type: 'integer',
    minimum: -32768,
    maximum: 32767,
  }),
);

/**
 * An integer from -32768 to 32767, the range of a signed 16-bit integer.
 */
export class Int16 extends Int16Base {}
