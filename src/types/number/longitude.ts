import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { FiniteNumber } from './finite-number.ts';
import { numberRule } from './number-rule.ts';

const LongitudeBase: SubtypeOf<typeof FiniteNumber, 'nominal.Longitude'> = FiniteNumber.subtype(
  'nominal.Longitude',
  numberRule('a longitude from -180 to 180', (value) => value >= -180 && value <= 180, {
    type: 'number',
    minimum: -180,
    maximum: 180,
    examples: [-0.1276],
  }),
);

/**
 * A longitude in decimal degrees, from -180 to 180, east of Greenwich positive, as WGS 84 and
 * GeoJSON (RFC 7946) write it.
 *
 * @remarks
 * Both ends are included and kept apart: -180 and 180 name one meridian, yet `equals` tells them
 * apart, as it compares values.
 *
 * @example
 * ```ts
 * import { Longitude } from '@horizon-republic/nominal-types';
 *
 * new Longitude(-0.1276).value; // -0.1276
 * Longitude.parse(181).ok; // false
 * ```
 */
export class Longitude extends LongitudeBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof Longitude>;
}
