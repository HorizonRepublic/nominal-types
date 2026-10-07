import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { Integer } from './integer.ts';

const isNonNegative = (value: unknown): value is number => typeof value === 'number' && value >= 0;

const NonNegativeIntegerBase: SubtypeOf<typeof Integer, 'NonNegativeInteger'> = Integer.subtype(
  'NonNegativeInteger',
  satisfying(isNonNegative, 'a non-negative integer', { type: 'integer', minimum: 0 }),
);

/**
 * A safe integer from 0 up, for counts that may be zero, offsets and indexes.
 *
 * @remarks
 * Unlike `PositiveInteger`, it takes 0. `-0` passes and stays `-0`; `equals` compares with
 * `Object.is`, so it differs from `0`.
 */
export class NonNegativeInteger extends NonNegativeIntegerBase {}
