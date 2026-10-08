import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { IpAddress } from './ip-address.ts';
import { ipv4Inside, isMapped, textOf } from './ip-bits.ts';
import { ipv6Source } from './ip-patterns.ts';
import { bitsOf, isIpv6Family } from './ip-text.ts';
import { Ipv4Address } from './ipv4-address.ts';

const Ipv6AddressBase: SubtypeOf<typeof IpAddress, 'nominal.Ipv6Address'> = IpAddress.subtype(
  'nominal.Ipv6Address',
  stringOnly(
    satisfying(isIpv6Family, 'an IPv6 address', {
      type: 'string',
      format: 'ipv6',
      pattern: ipv6Source,
      minLength: 2,
      maxLength: 45,
      examples: ['2001:db8::1'],
    }),
  ),
);

/**
 * An IPv6 address in any text form of RFC 4291 §2.2, such as `2001:db8::1` or `::ffff:192.0.2.1`.
 *
 * @remarks
 * Eight groups of one to four hex digits in either case, one `::` for one or more zero groups, and
 * a dotted quad in the last 32 bits. A zone such as `fe80::1%eth0` is refused, since it only means
 * something on one host, and so are brackets, which belong to URLs. The members are those of
 * `IpAddress`.
 *
 * @example
 * ```ts
 * import { Ipv6Address } from '@horizon-republic/nominal-types';
 *
 * new Ipv6Address('2001:0DB8::0001').canonical().value; // '2001:db8::1'
 * ```
 */
export class Ipv6Address extends Ipv6AddressBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Ipv6Address>;

  /**
   * The address as RFC 5952 writes it: lowercase, no leading zeros, the longest run of zero groups
   * as `::`, and an IPv4-mapped address as `::ffff:192.0.2.1`.
   *
   * @returns An address of the same class.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public override canonical(): this {
    return sameType(this, textOf(bitsOf(this.value)));
  }

  /**
   * The IPv4 address an IPv4-mapped address (`::ffff:0:0/96`) carries.
   *
   * @returns The IPv4 address, or `undefined` for any other address.
   */
  public toIpv4(): Ipv4Address | undefined {
    const bits = bitsOf(this.value);

    // @throws-ignore the 32 bits of a mapped address always write a valid IPv4 address
    return isMapped(bits) ? new Ipv4Address(textOf(ipv4Inside(bits))) : undefined;
  }
}
