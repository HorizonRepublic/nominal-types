import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { AnyBigInt } from './any-bigint.ts';

const lowest = -(2n ** 63n);
const highest = 2n ** 63n - 1n;

const inRange = (value: unknown): value is bigint =>
  typeof value === 'bigint' && value >= lowest && value <= highest;

const Int64Base: SubtypeOf<typeof AnyBigInt, 'Int64'> = AnyBigInt.subtype(
  'Int64',
  satisfying(inRange, 'a signed 64-bit integer', { type: 'string', maxLength: 20 }),
);

/**
 * An integer from -2^63 to 2^63 - 1, the range of a signed 64-bit integer and of a
 * Postgres `bigint`.
 *
 * @remarks
 * JSON Schema bounds the string's length rather than the value, so a string of the right length
 * beyond the range passes the schema and is refused when the type is built.
 */
export class Int64 extends Int64Base {}
