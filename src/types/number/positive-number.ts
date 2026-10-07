import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { FiniteNumber } from './finite-number.ts';

const isPositive = (value: unknown): value is number => typeof value === 'number' && value > 0;

const PositiveNumberBase: SubtypeOf<typeof FiniteNumber, 'PositiveNumber'> = FiniteNumber.subtype(
  'PositiveNumber',
  satisfying(isPositive, 'a positive number', { type: 'number', exclusiveMinimum: 0 }),
);

/**
 * A finite number above 0, for amounts and measures that can't be zero.
 *
 * @remarks
 * Zero is not positive, `-0` included; reach for `NonNegativeNumber` where 0 is a valid value.
 */
export class PositiveNumber extends PositiveNumberBase {}
