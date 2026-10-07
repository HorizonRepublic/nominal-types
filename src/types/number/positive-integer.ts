import type { SubtypeOf } from '../../core/contracts.ts';
import { Integer } from './integer.ts';
import { numberRule } from './number-rule.ts';

const PositiveIntegerBase: SubtypeOf<typeof Integer, 'PositiveInteger'> = Integer.subtype(
  'PositiveInteger',
  numberRule('a positive integer', (value) => value > 0, { type: 'integer', minimum: 1 }),
);

/**
 * A safe integer from 1 up, for counts that can't be empty, such as a quantity in an order, and
 * for serial identifiers.
 *
 * @remarks
 * Zero is not positive; reach for `NonNegativeInteger` where 0 is a valid value.
 */
export class PositiveInteger extends PositiveIntegerBase {}
