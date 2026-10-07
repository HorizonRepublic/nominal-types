import type { SubtypeOf } from '../../core/contracts.ts';
import { Integer } from './integer.ts';
import { numberRule } from './number-rule.ts';

const NegativeIntegerBase: SubtypeOf<typeof Integer, 'NegativeInteger'> = Integer.subtype(
  'NegativeInteger',
  numberRule('a negative integer', (value) => value < 0, { type: 'integer', maximum: -1 }),
);

/**
 * A safe integer from -1 down.
 *
 * @remarks
 * Zero is not negative; reach for `NonPositiveInteger` where 0 is a valid value.
 */
export class NegativeInteger extends NegativeIntegerBase {}
