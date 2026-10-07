import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { FiniteNumber } from './finite-number.ts';

const isNonPositive = (value: unknown): value is number => typeof value === 'number' && value <= 0;

const NonPositiveNumberBase: SubtypeOf<typeof FiniteNumber, 'NonPositiveNumber'> =
  FiniteNumber.subtype(
    'NonPositiveNumber',
    satisfying(isNonPositive, 'a non-positive number', { type: 'number', maximum: 0 }),
  );

/**
 * A finite number from 0 down.
 *
 * @remarks
 * Unlike `NegativeNumber`, it takes 0 and `-0`.
 */
export class NonPositiveNumber extends NonPositiveNumberBase {}
