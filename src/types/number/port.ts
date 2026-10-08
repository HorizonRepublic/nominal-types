import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { integerBetween } from './number-rule.ts';
import { PositiveInteger } from './positive-integer.ts';
import { Uint16 } from './uint16.ts';

const PortBase: SubtypeOf<typeof Uint16, 'nominal.Port', number, typeof PositiveInteger> =
  Uint16.subtype(
    'nominal.Port',
    integerBetween(1, 65535, 'a port from 1 to 65535', { examples: [8080] }),
    { implies: [PositiveInteger] },
  );

/**
 * A TCP or UDP port number from 1 to 65535, as RFC 6335 assigns them.
 *
 * @remarks
 * Port 0 is reserved and refused: it asks the system for any free port, which is not a port to
 * connect to. Reach for `Uint16` where 0 belongs. The value is a number; read `'8080'` from text
 * with `n.of(Port).fromString()`.
 *
 * @example
 * ```ts
 * import { Port } from '@horizon-republic/nominal-types';
 *
 * new Port(8080).value; // 8080
 * Port.parse(0).ok; // false
 * ```
 */
export class Port extends PortBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof Port>;
}
