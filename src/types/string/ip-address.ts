import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { inOneLine } from '../../core/same-value.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { bytesOf, textOf } from './ip-bits.ts';
import { ipv4Source, ipv6Source } from './ip-patterns.ts';
import { ipRanges } from './ip-ranges.ts';
import { bitsOf, isIpText } from './ip-text.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';

const IpAddressBase: SubtypeOf<
  typeof AnyString,
  'nominal.IpAddress',
  string,
  typeof NonBlankString
> = AnyString.subtype(
  'nominal.IpAddress',
  stringOnly(
    satisfying(isIpText, 'an IP address', {
      type: 'string',
      anyOf: [
        { format: 'ipv4', pattern: ipv4Source },
        { format: 'ipv6', pattern: ipv6Source },
      ],
      minLength: 2,
      maxLength: 45,
      examples: ['192.0.2.1', '2001:db8::1'],
    }),
  ),
  { implies: [nonBlankString], sensitive: true },
);

/**
 * An IPv4 or IPv6 address, such as `192.0.2.1` or `2001:db8::1`.
 *
 * @remarks
 * IPv4 is the dotted quad with no leading zeros, since `inet_aton` reads `010` as octal; IPv6 is
 * any text form of RFC 4291 §2.2, without a zone such as `%eth0` and without brackets. The value
 * keeps the text as given; `equals` compares the address, and `canonical()` writes it as RFC 5952
 * recommends. An address can be personal data, so messages leave it out.
 *
 * @example
 * ```ts
 * import { IpAddress } from '@horizon-republic/nominal-types';
 *
 * const address = new IpAddress('2001:DB8:0:0:0:0:0:1');
 * address.canonical().value; // '2001:db8::1'
 * address.isGlobal; // false, a documentation address
 * ```
 */
export class IpAddress extends IpAddressBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof IpAddress>;

  /**
   * The IP version, told by the text: 6 when it holds a colon.
   */
  public get version(): 4 | 6 {
    return this.value.includes(':') ? 6 : 4;
  }

  /**
   * The address in network byte order, for a socket API or a binary column.
   *
   * @returns A new array of 4 bytes for IPv4, 16 for IPv6.
   */
  public toBytes(): Uint8Array {
    return bytesOf(bitsOf(this.value));
  }

  /**
   * Whether the address is a loopback address, `127.0.0.0/8` or `::1`.
   *
   * @remarks
   * This and the other questions answer for the IPv4 address an IPv4-mapped address
   * (`::ffff:127.0.0.1`) carries, since a dual-stack socket connects there.
   */
  public get isLoopback(): boolean {
    return ipRanges.isLoopback(bitsOf(this.value));
  }

  /**
   * Whether the address is for private use: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   * (RFC 1918) or a unique local IPv6 address, `fc00::/7` (RFC 4193).
   */
  public get isPrivate(): boolean {
    return ipRanges.isPrivate(bitsOf(this.value));
  }

  /**
   * Whether the address is link-local, `169.254.0.0/16` or `fe80::/10`.
   */
  public get isLinkLocal(): boolean {
    return ipRanges.isLinkLocal(bitsOf(this.value));
  }

  /**
   * Whether the address is multicast, `224.0.0.0/4` or `ff00::/8`.
   */
  public get isMulticast(): boolean {
    return ipRanges.isMulticast(bitsOf(this.value));
  }

  /**
   * Whether the address is all zeros, `0.0.0.0` or `::`.
   */
  public get isUnspecified(): boolean {
    return ipRanges.isUnspecified(bitsOf(this.value));
  }

  /**
   * Whether the address is unicast and reachable across the internet, for refusing internal
   * addresses before connecting to one a user gave.
   *
   * @remarks
   * Follows the IANA special-purpose address registries (RFC 6890): a block they mark as not
   * globally reachable, such as private, shared, documentation or benchmarking space, gives
   * `false`. Multicast gives `false`, and so does IPv6 outside `2000::/3`. An address that carries
   * an IPv4 address, `::ffff:0:0/96`, `64:ff9b::/96` or `2002::/16`, answers for that IPv4 address.
   */
  public get isGlobal(): boolean {
    return ipRanges.isGlobal(bitsOf(this.value));
  }

  /**
   * The address as RFC 5952 writes it: lowercase, no leading zeros, the longest run of zero groups
   * as `::`, and an IPv4-mapped address as `::ffff:192.0.2.1`. IPv4 text is already canonical.
   *
   * @returns An address of the same class.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public canonical(): this {
    return sameType(this, textOf(bitsOf(this.value)));
  }

  /**
   * Whether the other value is the same address, however it is written, and belongs to this type, a
   * type under it or the type it is under, like `equals()` on every type.
   *
   * @remarks
   * An IPv4 address and the IPv4-mapped IPv6 address that carries it are different addresses.
   *
   * @param other - The value to compare with.
   * @returns `true` when both are the same address.
   */
  public override equals(other: unknown): boolean {
    return other instanceof IpAddress
      ? inOneLine(this, other) && textOf(bitsOf(other.value)) === textOf(bitsOf(this.value))
      : super.equals(other);
  }
}
