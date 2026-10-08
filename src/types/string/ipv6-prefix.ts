import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { canonicalPrefix } from './ip-network.ts';
import { ipv6PrefixSource } from './ip-patterns.ts';
import { IpPrefix } from './ip-prefix.ts';
import { isIpv6Family } from './ip-text.ts';
import { Ipv6Address } from './ipv6-address.ts';

const Ipv6PrefixBase: SubtypeOf<typeof IpPrefix, 'nominal.Ipv6Prefix'> = IpPrefix.subtype(
  'nominal.Ipv6Prefix',
  stringOnly(
    satisfying(isIpv6Family, 'an IPv6 prefix whose host bits are zero', {
      type: 'string',
      pattern: ipv6PrefixSource,
      minLength: 4,
      maxLength: 49,
      examples: ['2001:db8::/32'],
    }),
  ),
);

/**
 * An IPv6 network in CIDR notation, such as `2001:db8::/32`, with every bit past the length zero.
 *
 * @remarks
 * The members are those of `IpPrefix`, with `address` an `Ipv6Address`.
 *
 * @example
 * ```ts
 * new Ipv6Prefix('2001:DB8:0::/48').canonical().value; // '2001:db8::/48'
 * ```
 */
export class Ipv6Prefix extends Ipv6PrefixBase {
  /**
   * The first address of the network.
   */
  public override get address(): Ipv6Address {
    return new Ipv6Address(this.value.slice(0, this.value.indexOf('/')));
  }

  /**
   * The prefix with its address written as RFC 5952 recommends.
   */
  public override canonical(): this {
    return sameType(this, canonicalPrefix(this.value));
  }
}
