import type { SubtypeOf } from '../../core/contracts.ts';
import { AnyBigInt } from './any-bigint.ts';
import { bigintRule } from './bigint-rule.ts';
import { NonNegativeBigInt } from './non-negative-bigint.ts';

const highest = 2n ** 64n - 1n;

const Uint64Base: SubtypeOf<typeof AnyBigInt, 'nominal.Uint64', bigint, typeof NonNegativeBigInt> =
  AnyBigInt.subtype(
    'nominal.Uint64',
    bigintRule('an unsigned 64-bit integer', (value) => value >= 0n && value <= highest, {
      string: { type: 'string', pattern: '^(?:0|[1-9]\\d*)$', maxLength: 20 },
      integer: { type: 'integer', minimum: 0 },
      examples: ['18446744073709551615'],
    }),
    { implies: [NonNegativeBigInt] },
  );

/**
 * An integer from 0 to 2^64 - 1, the range of an unsigned 64-bit integer.
 *
 * @remarks
 * JSON Schema bounds the string's length rather than the value, so a string of the right length
 * beyond the range passes the schema and is refused when the type is built.
 */
export class Uint64 extends Uint64Base {}
