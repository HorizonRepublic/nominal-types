import type { SubtypeOf } from '../../core/contracts.ts';
import { FiniteNumber } from './finite-number.ts';
import { numberRule } from './number-rule.ts';

const NonNegativeNumberBase: SubtypeOf<typeof FiniteNumber, 'nominal.NonNegativeNumber'> =
  FiniteNumber.subtype(
    'nominal.NonNegativeNumber',
    numberRule('a non-negative number', (value) => value >= 0, { type: 'number', minimum: 0 }),
  );

/**
 * A finite number from 0 up, for measures that may be zero, such as a balance or a distance.
 *
 * @remarks
 * Unlike `PositiveNumber`, it takes 0. `-0` passes and stays `-0`; `equals` compares with
 * `Object.is`, so it differs from `0`.
 */
export class NonNegativeNumber extends NonNegativeNumberBase {}
