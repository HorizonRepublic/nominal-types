import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { FiniteNumber } from './finite-number.ts';
import { numberRule } from './number-rule.ts';

const LatitudeBase: SubtypeOf<typeof FiniteNumber, 'nominal.Latitude'> = FiniteNumber.subtype(
  'nominal.Latitude',
  numberRule('a latitude from -90 to 90', (value) => value >= -90 && value <= 90, {
    type: 'number',
    minimum: -90,
    maximum: 90,
    examples: [51.5072],
  }),
);

/**
 * A latitude in decimal degrees, from -90 (the South Pole) to 90 (the North Pole), as WGS 84 and
 * GeoJSON (RFC 7946) write it.
 *
 * @remarks
 * Both ends are included. The value is a number; read `'51.5'` from text with
 * `n.of(Latitude).fromString()`.
 *
 * @example
 * ```ts
 * import { Latitude } from '@horizon-republic/nominal-types';
 *
 * new Latitude(51.5072).value; // 51.5072
 * Latitude.parse(91).ok; // false
 * ```
 */
export class Latitude extends LatitudeBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof Latitude>;
}
