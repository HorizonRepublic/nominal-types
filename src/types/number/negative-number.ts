import type { SubtypeOf } from '../../core/contracts.ts';
import { FiniteNumber } from './finite-number.ts';
import { numberRule } from './number-rule.ts';

const NegativeNumberBase: SubtypeOf<typeof FiniteNumber, 'nominal.NegativeNumber'> =
  FiniteNumber.subtype(
    'nominal.NegativeNumber',
    numberRule('a negative number', (value) => value < 0, { type: 'number', exclusiveMaximum: 0 }),
  );

/**
 * A finite number below 0, for values that only ever go down, such as a write-off.
 *
 * @remarks
 * Zero is not negative, `-0` included; reach for `NonPositiveNumber` where 0 is a valid value.
 */
export class NegativeNumber extends NegativeNumberBase {}
