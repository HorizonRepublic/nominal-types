import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { AnyBigInt } from './any-bigint.ts';

const isNonPositive = (value: unknown): value is bigint => typeof value === 'bigint' && value <= 0n;

const NonPositiveBigIntBase: SubtypeOf<typeof AnyBigInt, 'NonPositiveBigInt'> = AnyBigInt.subtype(
  'NonPositiveBigInt',
  satisfying(isNonPositive, 'a non-positive integer', {
    type: 'string',
    pattern: '^(?:0|-[1-9]\\d*)$',
  }),
);

/**
 * A bigint from 0 down.
 *
 * @remarks
 * Unlike `NegativeBigInt`, it takes 0.
 */
export class NonPositiveBigInt extends NonPositiveBigIntBase {}
