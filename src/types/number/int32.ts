import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { Integer } from './integer.ts';

const inRange = (value: unknown): value is number =>
  typeof value === 'number' && value >= -2147483648 && value <= 2147483647;

const Int32Base: SubtypeOf<typeof Integer, 'Int32'> = Integer.subtype(
  'Int32',
  satisfying(inRange, 'a signed 32-bit integer', {
    type: 'integer',
    minimum: -2147483648,
    maximum: 2147483647,
    format: 'int32',
  }),
);

/**
 * An integer from -2147483648 to 2147483647, the range of a signed 32-bit integer.
 */
export class Int32 extends Int32Base {}
