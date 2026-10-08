import type { SubtypeOf } from '../../core/contracts.ts';
import { Integer } from './integer.ts';
import { NegativeNumber } from './negative-number.ts';
import { NonPositiveInteger } from './non-positive-integer.ts';
import { numberRule } from './number-rule.ts';

const NegativeIntegerBase: SubtypeOf<
  typeof Integer,
  'nominal.NegativeInteger',
  number,
  typeof NegativeNumber | typeof NonPositiveInteger
> = Integer.subtype(
  'nominal.NegativeInteger',
  numberRule('a negative integer', (value) => value < 0, { type: 'integer', maximum: -1 }),
  { implies: [NegativeNumber, NonPositiveInteger] },
);

/**
 * A safe integer from -1 down.
 *
 * @remarks
 * Zero is not negative; reach for `NonPositiveInteger` where 0 is a valid value.
 */
export class NegativeInteger extends NegativeIntegerBase {}
