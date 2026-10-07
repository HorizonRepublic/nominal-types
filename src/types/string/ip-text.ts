/**
 * Internal: an IP address as 16-bit groups, two for IPv4 and eight for IPv6, the form every
 * comparison and classification reads.
 */
export interface IpBits {
  readonly version: 4 | 6;
  readonly groups: Uint16Array;
}

const dot = 46;
const colon = 58;

const codeAt = (text: string, index: number): number => text.codePointAt(index) ?? -1;

const hexValue = (code: number): number => {
  if (code >= 48 && code <= 57) {
    return code - 48;
  }

  const lower = code | 0x20;

  return lower >= 97 && lower <= 102 ? lower - 87 : -1;
};

/**
 * Internal: the dotted quad between `from` and `to` as an unsigned 32-bit number, or -1.
 *
 * @remarks
 * Exactly four decimal parts from 0 to 255. A part with a leading zero is refused, since
 * `inet_aton` reads it as octal, which is what CVE-2021-28918 and CVE-2021-29921 came from.
 */
export const readIpv4 = (text: string, from: number, to: number): number => {
  if (to - from < 7 || to - from > 15) {
    return -1;
  }

  let result = 0;
  let part = 0;
  let digits = 0;
  let dots = 0;

  for (let index = from; index < to; index += 1) {
    const code = codeAt(text, index);

    if (code === dot) {
      if (digits === 0 || dots === 3) {
        return -1;
      }

      result = result * 256 + part;
      part = 0;
      digits = 0;
      dots += 1;
    } else if (code >= 48 && code <= 57 && (digits === 0 || part > 0)) {
      part = part * 10 + code - 48;
      digits += 1;

      if (part > 255) {
        return -1;
      }
    } else {
      return -1;
    }
  }

  return dots === 3 && digits > 0 ? result * 256 + part : -1;
};

const ipv4Into = (
  text: string,
  from: number,
  to: number,
  groups: Uint16Array,
  at: number,
): boolean => {
  const address = readIpv4(text, from, to);

  if (address === -1) {
    return false;
  }

  groups[at] = Math.floor(address / 0x1_00_00);
  groups[at + 1] = address % 0x1_00_00;

  return true;
};

// Groups separated by single colons, written from `at`, with a dotted quad allowed as the last
// piece of the address: how many groups were read, or -1.
const readRun = (
  text: string,
  from: number,
  to: number,
  groups: Uint16Array,
  at: number,
  last: boolean,
): number => {
  let index = from;
  let count = at;

  while (index < to) {
    let end = index;
    let value = 0;

    while (end < to) {
      const digit = hexValue(codeAt(text, end));

      if (digit === -1) {
        break;
      }

      value = value * 16 + digit;
      end += 1;
    }

    if (last && end < to && codeAt(text, end) === dot) {
      return count <= 6 && ipv4Into(text, index, to, groups, count) ? count + 2 - at : -1;
    }

    if (end === index || end - index > 4 || count === 8) {
      return -1;
    }

    groups[count] = value;
    count += 1;

    if (end === to) {
      return count - at;
    }

    if (codeAt(text, end) !== colon) {
      return -1;
    }

    index = end + 1;
  }

  return -1;
};

/**
 * Internal: reads the IPv6 text between `from` and `to` into eight groups, as RFC 4291 §2.2 writes
 * it: full, with one `::` standing for one or more zero groups, or with a dotted quad in the last
 * 32 bits. Zone identifiers and brackets are refused.
 */
export const readIpv6 = (text: string, from: number, to: number, groups: Uint16Array): boolean => {
  if (to - from < 2 || to - from > 45) {
    return false;
  }

  const gap = text.indexOf('::', from);

  if (gap === -1 || gap >= to) {
    return readRun(text, from, to, groups, 0, true) === 8;
  }

  const second = text.indexOf('::', gap + 1);

  if (second !== -1 && second < to) {
    return false;
  }

  const head = gap === from ? 0 : readRun(text, from, gap, groups, 0, false);
  const tail = gap + 2 === to || head === -1 ? 0 : readRun(text, gap + 2, to, groups, head, true);

  if (head === -1 || tail === -1 || head + tail > 7) {
    return false;
  }

  for (let index = tail - 1; index >= 0; index -= 1) {
    groups[8 - tail + index] = groups[head + index] ?? 0;
  }

  for (let index = head; index < 8 - tail; index += 1) {
    groups[index] = 0;
  }

  return true;
};

const scratch = new Uint16Array(8);

/**
 * Internal: whether a value is IPv4 or IPv6 text.
 */
export const isIpText = (value: unknown): value is string =>
  typeof value === 'string' &&
  (readIpv4(value, 0, value.length) !== -1 || readIpv6(value, 0, value.length, scratch));

/**
 * Internal: whether text an IP type has already accepted is IPv4, which has no colon.
 *
 * @remarks
 * The rules of the family types run after the rule of the type above them, which checked the
 * whole text, so the family is all that is left for them to tell.
 */
export const isIpv4Family = (value: unknown): value is string =>
  typeof value === 'string' && !value.includes(':');

/**
 * Internal: whether text an IP type has already accepted is IPv6, which has a colon.
 */
export const isIpv6Family = (value: unknown): value is string =>
  typeof value === 'string' && value.includes(':');

/**
 * Internal: the groups of the address text before `to`, which a type has already accepted.
 */
export const bitsOf = (text: string, to: number = text.length): IpBits => {
  if (text.lastIndexOf(':', to) === -1) {
    const groups = new Uint16Array(2);

    ipv4Into(text, 0, to, groups, 0);

    return { version: 4, groups };
  }

  const groups = new Uint16Array(8);

  readIpv6(text, 0, to, groups);

  return { version: 6, groups };
};
