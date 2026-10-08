import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { FiniteNumber } from './finite-number.ts';
import { numberRule } from './number-rule.ts';

const Float32Base: SubtypeOf<typeof FiniteNumber, 'nominal.Float32'> = FiniteNumber.subtype(
  'nominal.Float32',
  numberRule('a 32-bit float', (value) => Math.fround(value) === value, {
    type: 'number',
    format: 'float',
  }),
);

/**
 * A finite number a 32-bit float holds exactly, for `real` columns and `Float32Array`.
 *
 * @remarks
 * Most decimals have no exact 32-bit form, so `0.1` is rejected while `0.5` passes; round with
 * `Math.fround` before constructing. JSON Schema can't say this, so it describes a plain number
 * with the `float` format.
 *
 * @example
 * ```ts
 * import { Float32 } from '@horizon-republic/nominal-types';
 *
 * new Float32(0.5).value; // 0.5
 * new Float32(Math.fround(0.1)).value; // 0.10000000149011612
 * Float32.parse(0.1).ok; // false
 * ```
 */
export class Float32 extends Float32Base {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof Float32>;
}
