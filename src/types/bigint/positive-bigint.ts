import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { AnyBigInt } from './any-bigint.ts';

const isPositive = (value: unknown): value is bigint => typeof value === 'bigint' && value > 0n;

const PositiveBigIntBase: SubtypeOf<typeof AnyBigInt, 'PositiveBigInt'> = AnyBigInt.subtype(
  'PositiveBigInt',
  satisfying(isPositive, 'a positive integer', { type: 'string', pattern: '^[1-9]\\d*$' }),
);

/**
 * A bigint from 1 up.
 *
 * @remarks
 * Zero is not positive; reach for `NonNegativeBigInt` where 0 is a valid value.
 */
export class PositiveBigInt extends PositiveBigIntBase {}
