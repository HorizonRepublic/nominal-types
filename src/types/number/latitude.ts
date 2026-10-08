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
 */
export class Latitude extends LatitudeBase {
  declare public static readonly '~standard': StandardOf<typeof Latitude>;
}
