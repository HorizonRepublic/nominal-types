import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { FiniteNumber } from './finite-number.ts';
import { NonNegativeNumber } from './non-negative-number.ts';
import { numberRule } from './number-rule.ts';

const PositiveNumberBase: SubtypeOf<
  typeof FiniteNumber,
  'nominal.PositiveNumber',
  number,
  typeof NonNegativeNumber
> = FiniteNumber.subtype(
  'nominal.PositiveNumber',
  numberRule('a positive number', (value) => value > 0, { type: 'number', exclusiveMinimum: 0 }),
  { implies: [NonNegativeNumber] },
);

/**
 * A finite number above 0, for amounts and measures that can't be zero.
 *
 * @remarks
 * Zero is not positive, `-0` included; reach for `NonNegativeNumber` where 0 is a valid value.
 */
export class PositiveNumber extends PositiveNumberBase {
  declare public static readonly '~standard': StandardOf<typeof PositiveNumber>;
}
