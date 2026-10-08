import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { IpAddress } from './ip-address.ts';
import { ipv4Source } from './ip-patterns.ts';
import { isIpv4Family } from './ip-text.ts';

const Ipv4AddressBase: SubtypeOf<typeof IpAddress, 'nominal.Ipv4Address'> = IpAddress.subtype(
  'nominal.Ipv4Address',
  stringOnly(
    satisfying(isIpv4Family, 'an IPv4 address', {
      type: 'string',
      format: 'ipv4',
      pattern: ipv4Source,
      minLength: 7,
      maxLength: 15,
      examples: ['192.0.2.1'],
    }),
  ),
);

/**
 * An IPv4 address in dotted-quad form, such as `192.0.2.1`: four decimal parts from 0 to 255.
 *
 * @remarks
 * A part with a leading zero, such as `010`, is refused, since `inet_aton` reads it as octal and
 * reaches another host (CVE-2021-28918, CVE-2021-29921). Hex parts and short forms such as `127.1`
 * are refused too. The members are those of `IpAddress`.
 *
 * @example
 * ```ts
 * import { Ipv4Address } from '@horizon-republic/nominal-types';
 *
 * new Ipv4Address('10.0.0.1').isPrivate; // true
 * ```
 */
export class Ipv4Address extends Ipv4AddressBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Ipv4Address>;

  /**
   * The same address; IPv4 text has one form only.
   *
   * @returns An address of the same class.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public override canonical(): this {
    return sameType(this, this.value);
  }
}
