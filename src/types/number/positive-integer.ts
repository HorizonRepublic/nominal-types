import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { Integer } from './integer.ts';
import { NonNegativeInteger } from './non-negative-integer.ts';
import { numberRule } from './number-rule.ts';
import { PositiveNumber } from './positive-number.ts';

const PositiveIntegerBase: SubtypeOf<
  typeof Integer,
  'nominal.PositiveInteger',
  number,
  typeof PositiveNumber | typeof NonNegativeInteger
> = Integer.subtype(
  'nominal.PositiveInteger',
  numberRule('a positive integer', (value) => value > 0, { type: 'integer', minimum: 1 }),
  { implies: [PositiveNumber, NonNegativeInteger] },
);

/**
 * A safe integer from 1 up, for counts that can't be empty, such as a quantity in an order, and
 * for serial identifiers.
 *
 * @remarks
 * Zero is not positive; reach for `NonNegativeInteger` where 0 is a valid value.
 */
export class PositiveInteger extends PositiveIntegerBase {
  declare public static readonly '~standard': StandardOf<typeof PositiveInteger>;
}
