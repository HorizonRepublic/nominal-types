import type { SubtypeOf } from '../../core/contracts.ts';
import { AnyBigInt } from './any-bigint.ts';
import { bigintRule } from './bigint-rule.ts';

const lowest = -(2n ** 63n);
const highest = 2n ** 63n - 1n;

const Int64Base: SubtypeOf<typeof AnyBigInt, 'nominal.Int64'> = AnyBigInt.subtype(
  'nominal.Int64',
  bigintRule('a signed 64-bit integer', (value) => value >= lowest && value <= highest, {
    type: 'string',
    format: 'int64',
    maxLength: 20,
    examples: ['-9223372036854775808'],
  }),
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
