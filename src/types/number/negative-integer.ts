import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { Integer } from './integer.ts';

const isNegative = (value: unknown): value is number => typeof value === 'number' && value < 0;

const NegativeIntegerBase: SubtypeOf<typeof Integer, 'NegativeInteger'> = Integer.subtype(
  'NegativeInteger',
  satisfying(isNegative, 'a negative integer', { type: 'integer', maximum: -1 }),
);

/**
 * A safe integer from -1 down.
 *
 * @remarks
 * Zero is not negative; reach for `NonPositiveInteger` where 0 is a valid value.
 */
export class NegativeInteger extends NegativeIntegerBase {}
