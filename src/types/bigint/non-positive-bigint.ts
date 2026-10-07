import type { SubtypeOf } from '../../core/contracts.ts';
import { AnyBigInt } from './any-bigint.ts';
import { bigintRule } from './bigint-rule.ts';

const NonPositiveBigIntBase: SubtypeOf<typeof AnyBigInt, 'NonPositiveBigInt'> = AnyBigInt.subtype(
  'NonPositiveBigInt',
  bigintRule('a non-positive integer', (value) => value <= 0n, {
    type: 'string',
    pattern: '^(?:0|-[1-9]\\d*)$',
    examples: ['-9007199254740993'],
  }),
);

/**
 * A bigint from 0 down.
 *
 * @remarks
 * Unlike `NegativeBigInt`, it takes 0.
 */
export class NonPositiveBigInt extends NonPositiveBigIntBase {}
