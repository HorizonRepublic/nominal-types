import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { Integer } from './integer.ts';

const inRange = (value: unknown): value is number =>
  typeof value === 'number' && value >= -128 && value <= 127;

const Int8Base: SubtypeOf<typeof Integer, 'Int8'> = Integer.subtype(
  'Int8',
  satisfying(inRange, 'a signed 8-bit integer', { type: 'integer', minimum: -128, maximum: 127 }),
);

/**
 * An integer from -128 to 127, the range of a signed 8-bit integer.
 */
export class Int8 extends Int8Base {}
