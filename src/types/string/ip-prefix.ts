import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { inOneLine } from '../../core/same-value.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { IpAddress } from './ip-address.ts';
import { samePrefix } from './ip-bits.ts';
import { canonicalPrefix, isIpPrefixText, networkOf } from './ip-network.ts';
import { ipv4PrefixSource, ipv6PrefixSource } from './ip-patterns.ts';
import { bitsOf } from './ip-text.ts';

const IpPrefixBase: SubtypeOf<typeof AnyString, 'nominal.IpPrefix'> = AnyString.subtype(
  'nominal.IpPrefix',
  stringOnly(
    satisfying(isIpPrefixText, 'an IP prefix whose host bits are zero', {
      type: 'string',
      anyOf: [{ pattern: ipv4PrefixSource }, { pattern: ipv6PrefixSource }],
      minLength: 4,
      maxLength: 49,
      examples: ['192.0.2.0/24', '2001:db8::/32'],
    }),
  ),
);

/**
 * A network as an IPv4 or IPv6 prefix in CIDR notation, such as `192.0.2.0/24` or `2001:db8::/32`.
 *
 * @remarks
 * The address is written as `IpAddress` takes it, and the length is a decimal from 0 to 32 or 128
 * without leading zeros (RFC 4632 §3.1, RFC 4291 §2.3). Every bit past the length must be zero:
 * `10.0.0.1/8` names an interface, not a network, and is refused. JSON Schema cannot check those
 * bits, so the generated schema accepts such text.
 *
 * @example
 * ```ts
 * import { IpAddress, IpPrefix } from '@horizon-republic/nominal-types';
 *
 * const network = new IpPrefix('10.0.0.0/8');
 * network.contains(new IpAddress('10.1.2.3')); // true
 * ```
 */
export class IpPrefix extends IpPrefixBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof IpPrefix>;

  /**
   * The IP version of the address.
   */
  public get version(): 4 | 6 {
    return this.value.includes(':') ? 6 : 4;
  }

  /**
   * The first address of the network, as written before the `/`.
   */
  public get address(): IpAddress {
    return new IpAddress(this.value.slice(0, this.value.indexOf('/')));
  }

  /**
   * The prefix length: how many leading bits name the network.
   */
  public get length(): number {
    return networkOf(this.value).length;
  }

  /**
   * Whether an address, or every address of another prefix, lies in this network.
   *
   * @remarks
   * An address of the other IP version is never in it, IPv4-mapped ones included.
   *
   * @param other - The address or the prefix to look for.
   * @returns `true` when all of it lies in this network.
   */
  public contains(other: IpAddress | IpPrefix): boolean {
    const network = networkOf(this.value);

    if (other instanceof IpPrefix) {
      const inner = networkOf(other.value);

      return inner.length >= network.length && samePrefix(network.bits, inner.bits, network.length);
    }

    return samePrefix(network.bits, bitsOf(other.value), network.length);
  }

  /**
   * The prefix with its address written as RFC 5952 recommends, such as `2001:db8::/32`.
   *
   * @returns A prefix of the same class.
   */
  public canonical(): this {
    return sameType(this, canonicalPrefix(this.value));
  }

  /**
   * Whether the other value is the same network, however its address is written, and belongs to
   * this type, a type under it or the type it is under, like `equals()` on every type.
   *
   * @param other - The value to compare with.
   * @returns `true` when both are the same network.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) &&
      other instanceof IpPrefix &&
      canonicalPrefix(other.value) === canonicalPrefix(this.value)
    );
  }
}
