import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { AnyBigInt } from './any-bigint.ts';

const isNonNegative = (value: unknown): value is bigint => typeof value === 'bigint' && value >= 0n;

const NonNegativeBigIntBase: SubtypeOf<typeof AnyBigInt, 'NonNegativeBigInt'> = AnyBigInt.subtype(
  'NonNegativeBigInt',
  satisfying(isNonNegative, 'a non-negative integer', {
    type: 'string',
    pattern: '^(?:0|[1-9]\\d*)$',
    examples: ['9007199254740993'],
  }),
);

/**
 * A bigint from 0 up.
 *
 * @remarks
 * Unlike `PositiveBigInt`, it takes 0.
 */
export class NonNegativeBigInt extends NonNegativeBigIntBase {}
