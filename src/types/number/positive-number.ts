import type { SubtypeOf } from '../../core/contracts.ts';
import { FiniteNumber } from './finite-number.ts';
import { numberRule } from './number-rule.ts';

const PositiveNumberBase: SubtypeOf<typeof FiniteNumber, 'PositiveNumber'> = FiniteNumber.subtype(
  'PositiveNumber',
  numberRule('a positive number', (value) => value > 0, { type: 'number', exclusiveMinimum: 0 }),
);

/**
 * A finite number above 0, for amounts and measures that can't be zero.
 *
 * @remarks
 * Zero is not positive, `-0` included; reach for `NonNegativeNumber` where 0 is a valid value.
 */
export class PositiveNumber extends PositiveNumberBase {}
