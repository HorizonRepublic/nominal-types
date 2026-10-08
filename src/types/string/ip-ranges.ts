import { ipv4Inside, isMapped, samePrefix } from './ip-bits.ts';
import { networkOf } from './ip-network.ts';
import type { IpNetwork } from './ip-network.ts';
import type { IpBits } from './ip-text.ts';

const rangesOf = (...texts: readonly string[]): readonly IpNetwork[] =>
  texts.map((text) => networkOf(text));

const within = (bits: IpBits, ranges: readonly IpNetwork[]): boolean =>
  ranges.some((range) => samePrefix(bits, range.bits, range.length));

// An IPv4-mapped address answers as the IPv4 address it carries.
const asUsed = (bits: IpBits): IpBits => (isMapped(bits) ? ipv4Inside(bits) : bits);

const loopback = rangesOf('127.0.0.0/8', '::1/128');
const privateUse = rangesOf('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7');
const linkLocal = rangesOf('169.254.0.0/16', 'fe80::/10');
const multicast = rangesOf('224.0.0.0/4', 'ff00::/8');
const unspecified = rangesOf('0.0.0.0/32', '::/128');

// The blocks the IANA special-purpose registries (RFC 6890) mark as not globally reachable, with
// multicast and the reserved 240.0.0.0/4 folded into 224.0.0.0/3; the exceptions inside them are
// reachable.
const notGlobal = rangesOf(
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/3',
  '2001::/23',
  '2001:db8::/32',
  '3fff::/20',
);
const globalInside = rangesOf(
  '192.0.0.9/32',
  '192.0.0.10/32',
  '2001:1::1/128',
  '2001:1::2/128',
  '2001:1::3/128',
  '2001:3::/32',
  '2001:4:112::/48',
  '2001:20::/28',
  '2001:30::/28',
);
const globalUnicast = rangesOf('2000::/3');
const nat64 = rangesOf('64:ff9b::/96');
const sixToFour = rangesOf('2002::/16');

/**
 * The special-purpose blocks an address falls in, each a question an `IpAddress` answers.
 *
 * @internal
 */
export const ipRanges: {
  readonly isLoopback: (bits: IpBits) => boolean;
  readonly isPrivate: (bits: IpBits) => boolean;
  readonly isLinkLocal: (bits: IpBits) => boolean;
  readonly isMulticast: (bits: IpBits) => boolean;
  readonly isUnspecified: (bits: IpBits) => boolean;
  readonly isGlobal: (bits: IpBits) => boolean;
} = {
  isLoopback: (bits) => within(asUsed(bits), loopback),
  isPrivate: (bits) => within(asUsed(bits), privateUse),
  isLinkLocal: (bits) => within(asUsed(bits), linkLocal),
  isMulticast: (bits) => within(asUsed(bits), multicast),
  isUnspecified: (bits) => within(asUsed(bits), unspecified),
  isGlobal: (bits) => {
    const used = asUsed(bits);

    if (within(used, nat64)) {
      return ipRanges.isGlobal(ipv4Inside(used));
    }

    if (within(used, sixToFour)) {
      return ipRanges.isGlobal(ipv4Inside(used, 1));
    }

    if (used.version === 6 && !within(used, globalUnicast)) {
      return false;
    }

    return within(used, globalInside) || !within(used, notGlobal);
  },
};
