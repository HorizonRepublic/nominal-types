import type { SubtypeOf } from '../../core/contracts.ts';
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
 * `schemaOf(Latitude).fromString()`.
 */
export class Latitude extends LatitudeBase {}
