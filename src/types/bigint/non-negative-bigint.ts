import type { SubtypeOf } from '../../core/contracts.ts';
import { AnyBigInt } from './any-bigint.ts';
import { bigintRule } from './bigint-rule.ts';

const NonNegativeBigIntBase: SubtypeOf<typeof AnyBigInt, 'nominal.NonNegativeBigInt'> =
  AnyBigInt.subtype(
    'nominal.NonNegativeBigInt',
    bigintRule('a non-negative integer', (value) => value >= 0n, {
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
