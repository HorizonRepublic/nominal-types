import type { SubtypeOf } from '../../core/contracts.ts';
import { Integer } from './integer.ts';
import { numberRule } from './number-rule.ts';

const NonNegativeIntegerBase: SubtypeOf<typeof Integer, 'NonNegativeInteger'> = Integer.subtype(
  'NonNegativeInteger',
  numberRule('a non-negative integer', (value) => value >= 0, { type: 'integer', minimum: 0 }),
);

/**
 * A safe integer from 0 up, for counts that may be zero, offsets and indexes.
 *
 * @remarks
 * Unlike `PositiveInteger`, it takes 0. `-0` passes and stays `-0`; `equals` compares with
 * `Object.is`, so it differs from `0`.
 */
export class NonNegativeInteger extends NonNegativeIntegerBase {}
