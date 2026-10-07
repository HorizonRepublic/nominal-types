import type { SubtypeOf } from '../../core/contracts.ts';
import { integerBetween } from './number-rule.ts';
import { Uint16 } from './uint16.ts';

const PortBase: SubtypeOf<typeof Uint16, 'nominal.Port'> = Uint16.subtype(
  'nominal.Port',
  integerBetween(1, 65535, 'a port from 1 to 65535', { examples: [8080] }),
);

/**
 * A TCP or UDP port number from 1 to 65535, as RFC 6335 assigns them.
 *
 * @remarks
 * Port 0 is reserved and refused: it asks the system for any free port, which is not a port to
 * connect to. Reach for `Uint16` where 0 belongs. The value is a number; read `'8080'` from text
 * with `schemaOf(Port).fromString()`.
 */
export class Port extends PortBase {}
