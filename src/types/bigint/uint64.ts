import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { AnyBigInt } from './any-bigint.ts';

const highest = 2n ** 64n - 1n;

const inRange = (value: unknown): value is bigint =>
  typeof value === 'bigint' && value >= 0n && value <= highest;

const Uint64Base: SubtypeOf<typeof AnyBigInt, 'Uint64'> = AnyBigInt.subtype(
  'Uint64',
  satisfying(inRange, 'an unsigned 64-bit integer', {
    type: 'string',
    pattern: '^(?:0|[1-9]\\d*)$',
    maxLength: 20,
  }),
);

/**
 * An integer from 0 to 2^64 - 1, the range of an unsigned 64-bit integer.
 *
 * @remarks
 * JSON Schema bounds the string's length rather than the value, so a string of the right length
 * beyond the range passes the schema and is refused when the type is built.
 */
export class Uint64 extends Uint64Base {}
