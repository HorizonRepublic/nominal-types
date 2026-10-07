import type { IpBits } from './ip-text.ts';

/**
 * Internal: the address as bytes in network order, 4 for IPv4 and 16 for IPv6.
 */
export const bytesOf = (bits: IpBits): Uint8Array => {
  const bytes = new Uint8Array(bits.groups.length * 2);

  for (const [index, group] of bits.groups.entries()) {
    bytes[index * 2] = group >> 8;
    bytes[index * 2 + 1] = group & 0xff;
  }

  return bytes;
};

const dottedOf = (high: number, low: number): string =>
  `${String(high >> 8)}.${String(high & 0xff)}.${String(low >> 8)}.${String(low & 0xff)}`;

/**
 * Internal: whether an IPv6 address is IPv4-mapped, `::ffff:0:0/96`.
 */
export const isMapped = (bits: IpBits): boolean => {
  const { groups } = bits;

  return (
    bits.version === 6 &&
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xff_ff
  );
};

/**
 * Internal: the IPv4 address in two groups of an IPv6 address, the last two unless told otherwise.
 */
export const ipv4Inside = (bits: IpBits, at = 6): IpBits => ({
  version: 4,
  groups: bits.groups.slice(at, at + 2),
});

// The longest run of two or more zero groups, the first of equal ones, as [start, end).
const longestZeroRun = (groups: Uint16Array): readonly [number, number] => {
  let best: readonly [number, number] = [-1, -1];
  let start = -1;

  for (let index = 0; index <= groups.length; index += 1) {
    if (index < groups.length && groups[index] === 0) {
      start = start === -1 ? index : start;
    } else if (start !== -1) {
      best = index - start >= 2 && index - start > best[1] - best[0] ? [start, index] : best;
      start = -1;
    }
  }

  return best;
};

const hexOf = (groups: Uint16Array, from: number, to: number): string =>
  Array.from(groups.subarray(from, to), (group) => group.toString(16)).join(':');

/**
 * Internal: the address as RFC 5952 §4 writes it: lowercase, no leading zeros, the longest run of
 * two or more zero groups shortened to `::`, the first of equal runs, and an IPv4-mapped address
 * with its IPv4 part dotted (§5). IPv4 text has one form only.
 */
export const textOf = (bits: IpBits): string => {
  const { groups } = bits;

  if (bits.version === 4) {
    return dottedOf(groups[0] ?? 0, groups[1] ?? 0);
  }

  if (isMapped(bits)) {
    return `::ffff:${dottedOf(groups[6] ?? 0, groups[7] ?? 0)}`;
  }

  const [start, end] = longestZeroRun(groups);

  return start === -1
    ? hexOf(groups, 0, 8)
    : `${hexOf(groups, 0, start)}::${hexOf(groups, end, 8)}`;
};

/**
 * Internal: the bits of the group at `index` that a prefix of `length` bits covers.
 */
export const maskOf = (length: number, index: number): number => {
  const bits = Math.min(16, Math.max(0, length - index * 16));

  return (0xff_ff << (16 - bits)) & 0xff_ff;
};

/**
 * Internal: whether two addresses are of one family and agree in their first `length` bits.
 */
export const samePrefix = (left: IpBits, right: IpBits, length: number): boolean =>
  left.version === right.version &&
  left.groups.every((group, index) => {
    const mask = maskOf(length, index);

    return (group & mask) === ((right.groups[index] ?? 0) & mask);
  });
