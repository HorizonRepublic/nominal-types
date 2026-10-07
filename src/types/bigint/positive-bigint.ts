import type { SubtypeOf } from '../../core/contracts.ts';
import { AnyBigInt } from './any-bigint.ts';
import { bigintRule } from './bigint-rule.ts';

const PositiveBigIntBase: SubtypeOf<typeof AnyBigInt, 'PositiveBigInt'> = AnyBigInt.subtype(
  'PositiveBigInt',
  bigintRule('a positive integer', (value) => value > 0n, {
    type: 'string',
    pattern: '^[1-9]\\d*$',
    examples: ['9007199254740993'],
  }),
);

/**
 * A bigint from 1 up.
 *
 * @remarks
 * Zero is not positive; reach for `NonNegativeBigInt` where 0 is a valid value.
 */
export class PositiveBigInt extends PositiveBigIntBase {}
