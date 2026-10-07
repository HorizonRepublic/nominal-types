import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { Integer } from './integer.ts';

const isPositive = (value: unknown): value is number => typeof value === 'number' && value > 0;

const PositiveIntegerBase: SubtypeOf<typeof Integer, 'PositiveInteger'> = Integer.subtype(
  'PositiveInteger',
  satisfying(isPositive, 'a positive integer', { type: 'integer', minimum: 1 }),
);

/**
 * A safe integer from 1 up, for counts that can't be empty, such as a quantity in an order, and
 * for serial identifiers.
 *
 * @remarks
 * Zero is not positive; reach for `NonNegativeInteger` where 0 is a valid value.
 */
export class PositiveInteger extends PositiveIntegerBase {}
