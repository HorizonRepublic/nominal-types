import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyBigInt } from './any-bigint.ts';
import { bigintRule } from './bigint-rule.ts';

const lowest = -(2n ** 63n);
const highest = 2n ** 63n - 1n;

const Int64Base: SubtypeOf<typeof AnyBigInt, 'nominal.Int64'> = AnyBigInt.subtype(
  'nominal.Int64',
  bigintRule('a signed 64-bit integer', (value) => value >= lowest && value <= highest, {
    string: { type: 'string', format: 'int64', maxLength: 20 },
    integer: { type: 'integer' },
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
 *
 * @example
 * ```ts
 * import { Int64 } from '@horizon-republic/nominal-types';
 *
 * new Int64('-9223372036854775808').value; // -9223372036854775808n
 * Int64.parse('9223372036854775808').ok; // false
 * ```
 */
export class Int64 extends Int64Base {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof Int64>;
}
