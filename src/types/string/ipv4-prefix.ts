import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { ipv4PrefixSource } from './ip-patterns.ts';
import { IpPrefix } from './ip-prefix.ts';
import { isIpv4Family } from './ip-text.ts';
import { Ipv4Address } from './ipv4-address.ts';

const Ipv4PrefixBase: SubtypeOf<typeof IpPrefix, 'nominal.Ipv4Prefix'> = IpPrefix.subtype(
  'nominal.Ipv4Prefix',
  stringOnly(
    satisfying(isIpv4Family, 'an IPv4 prefix whose host bits are zero', {
      type: 'string',
      pattern: ipv4PrefixSource,
      minLength: 9,
      maxLength: 18,
      examples: ['192.0.2.0/24'],
    }),
  ),
);

/**
 * An IPv4 network in CIDR notation, such as `192.0.2.0/24`, with every bit past the length zero.
 *
 * @remarks
 * The members are those of `IpPrefix`, with `address` an `Ipv4Address`.
 *
 * @example
 * ```ts
 * new Ipv4Prefix('192.168.0.0/16').contains(new Ipv4Address('192.168.1.10')); // true
 * ```
 */
export class Ipv4Prefix extends Ipv4PrefixBase {
  declare public static readonly '~standard': StandardOf<typeof Ipv4Prefix>;

  /**
   * The first address of the network.
   */
  public override get address(): Ipv4Address {
    return new Ipv4Address(this.value.slice(0, this.value.indexOf('/')));
  }

  /**
   * The same prefix; IPv4 text has one form only.
   */
  public override canonical(): this {
    return sameType(this, this.value);
  }
}
