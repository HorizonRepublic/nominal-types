import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyNumber } from './any-number.ts';

const isFinite = (value: unknown): value is number => Number.isFinite(value);

const FiniteNumberBase: SubtypeOf<typeof AnyNumber, 'nominal.FiniteNumber'> = AnyNumber.subtype(
  'nominal.FiniteNumber',
  satisfying(isFinite, 'a finite number', { type: 'number', format: 'double' }),
);

/**
 * A number other than `NaN` and the infinities: every number JSON can carry.
 *
 * @example
 * ```ts
 * import { FiniteNumber } from '@horizon-republic/nominal-types';
 *
 * new FiniteNumber(0.25).value; // 0.25
 * FiniteNumber.parse(Number.NaN).ok; // false
 * ```
 */
export class FiniteNumber extends FiniteNumberBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof FiniteNumber>;
}
