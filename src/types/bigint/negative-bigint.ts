import type { SubtypeOf } from '../../core/contracts.ts';
import { AnyBigInt } from './any-bigint.ts';
import { bigintRule } from './bigint-rule.ts';

const NegativeBigIntBase: SubtypeOf<typeof AnyBigInt, 'nominal.NegativeBigInt'> = AnyBigInt.subtype(
  'nominal.NegativeBigInt',
  bigintRule('a negative integer', (value) => value < 0n, {
    string: { type: 'string', pattern: '^-[1-9]\\d*$' },
    integer: { type: 'integer', maximum: -1 },
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
