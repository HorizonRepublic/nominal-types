import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { Integer } from './integer.ts';

const isNonPositive = (value: unknown): value is number => typeof value === 'number' && value <= 0;

const NonPositiveIntegerBase: SubtypeOf<typeof Integer, 'NonPositiveInteger'> = Integer.subtype(
  'NonPositiveInteger',
  satisfying(isNonPositive, 'a non-positive integer', { type: 'integer', maximum: 0 }),
);

/**
 * A safe integer from 0 down.
 *
 * @remarks
 * Unlike `NegativeInteger`, it takes 0 and `-0`.
 */
export class NonPositiveInteger extends NonPositiveIntegerBase {}
