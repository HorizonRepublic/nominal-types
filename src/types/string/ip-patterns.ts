// The JSON Schema patterns of the address and prefix types, the same grammar as the parsers in
// `ip-text.ts`. A pattern cannot see host bits, so the prefix patterns accept prefixes with host
// bits set, which the types refuse.

const octet = '(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
const ipv4 = `${octet}(?:\\.${octet}){3}`;
const h16 = '[0-9A-Fa-f]{1,4}';
const ls32 = `(?:${h16}:${h16}|${ipv4})`;

// RFC 3986 §3.2.2 IPv6address, which spells out RFC 4291 §2.2 one case of `::` at a time.
const ipv6 = [
  `(?:${h16}:){6}${ls32}`,
  `::(?:${h16}:){5}${ls32}`,
  `(?:${h16})?::(?:${h16}:){4}${ls32}`,
  `(?:(?:${h16}:){0,1}${h16})?::(?:${h16}:){3}${ls32}`,
  `(?:(?:${h16}:){0,2}${h16})?::(?:${h16}:){2}${ls32}`,
  `(?:(?:${h16}:){0,3}${h16})?::${h16}:${ls32}`,
  `(?:(?:${h16}:){0,4}${h16})?::${ls32}`,
  `(?:(?:${h16}:){0,5}${h16})?::${h16}`,
  `(?:(?:${h16}:){0,6}${h16})?::`,
].join('|');

/**
 * Internal: IPv4 dotted-quad text as a pattern source.
 */
export const ipv4Source: string = `^${ipv4}$`;

/**
 * Internal: IPv6 text as a pattern source.
 */
export const ipv6Source: string = `^(?:${ipv6})$`;

/**
 * Internal: an IPv4 prefix as a pattern source, lengths 0 to 32.
 */
export const ipv4PrefixSource: string = `^${ipv4}/(?:3[0-2]|[12]?[0-9])$`;

/**
 * Internal: an IPv6 prefix as a pattern source, lengths 0 to 128.
 */
export const ipv6PrefixSource: string = `^(?:${ipv6})/(?:12[0-8]|1[01][0-9]|[1-9]?[0-9])$`;
