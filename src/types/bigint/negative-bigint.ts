import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { AnyBigInt } from './any-bigint.ts';

const isNegative = (value: unknown): value is bigint => typeof value === 'bigint' && value < 0n;

const NegativeBigIntBase: SubtypeOf<typeof AnyBigInt, 'NegativeBigInt'> = AnyBigInt.subtype(
  'NegativeBigInt',
  satisfying(isNegative, 'a negative integer', {
    type: 'string',
    pattern: '^-[1-9]\\d*$',
    examples: ['-9007199254740993'],
  }),
);

/**
 * A bigint from -1 down.
 *
 * @remarks
 * Zero is not negative; reach for `NonPositiveBigInt` where 0 is a valid value.
 */
export class NegativeBigInt extends NegativeBigIntBase {}
