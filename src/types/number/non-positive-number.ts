import type { SubtypeOf } from '../../core/contracts.ts';
import { FiniteNumber } from './finite-number.ts';
import { numberRule } from './number-rule.ts';

const NonPositiveNumberBase: SubtypeOf<typeof FiniteNumber, 'NonPositiveNumber'> =
  FiniteNumber.subtype(
    'NonPositiveNumber',
    numberRule('a non-positive number', (value) => value <= 0, { type: 'number', maximum: 0 }),
  );

/**
 * A finite number from 0 down.
 *
 * @remarks
 * Unlike `NegativeNumber`, it takes 0 and `-0`.
 */
export class NonPositiveNumber extends NonPositiveNumberBase {}
