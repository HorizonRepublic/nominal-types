import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { FiniteNumber } from './finite-number.ts';

const isNegative = (value: unknown): value is number => typeof value === 'number' && value < 0;

const NegativeNumberBase: SubtypeOf<typeof FiniteNumber, 'NegativeNumber'> = FiniteNumber.subtype(
  'NegativeNumber',
  satisfying(isNegative, 'a negative number', { type: 'number', exclusiveMaximum: 0 }),
);

/**
 * A finite number below 0, for values that only ever go down, such as a write-off.
 *
 * @remarks
 * Zero is not negative, `-0` included; reach for `NonPositiveNumber` where 0 is a valid value.
 */
export class NegativeNumber extends NegativeNumberBase {}
