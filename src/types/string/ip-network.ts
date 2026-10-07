import { maskOf, textOf } from './ip-bits.ts';
import { bitsOf, readIpv4, readIpv6 } from './ip-text.ts';
import type { IpBits } from './ip-text.ts';

/**
 * Internal: a network written as `a/n`: its address and its prefix length.
 */
export interface IpNetwork {
  readonly bits: IpBits;
  readonly length: number;
}

const prefixLengthOf = (text: string, from: number, highest: number): number => {
  const digits = text.length - from;

  if (digits < 1 || digits > 3 || (digits > 1 && text.startsWith('0', from))) {
    return -1;
  }

  let length = 0;

  for (let index = from; index < text.length; index += 1) {
    const code = text.codePointAt(index) ?? -1;

    if (code < 48 || code > 57) {
      return -1;
    }

    length = length * 10 + code - 48;
  }

  return length <= highest ? length : -1;
};

// Whether the first `count` groups are zero past the first `length` bits.
const hostBitsZero = (groups: Uint16Array, count: number, length: number): boolean => {
  for (let index = Math.floor(length / 16); index < count; index += 1) {
    if (((groups[index] ?? 0) & ~maskOf(length, index) & 0xff_ff) !== 0) {
      return false;
    }
  }

  return true;
};

const scratch = new Uint16Array(8);

// An IPv4 prefix, `a/n` per RFC 4632 §3.1, with every bit past the prefix length zero.
const isIpv4PrefixText = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const at = value.indexOf('/');
  const address = at === -1 ? -1 : readIpv4(value, 0, at);
  const length = address === -1 ? -1 : prefixLengthOf(value, at + 1, 32);

  if (length === -1) {
    return false;
  }

  scratch[0] = Math.floor(address / 0x1_00_00);
  scratch[1] = address % 0x1_00_00;

  return hostBitsZero(scratch, 2, length);
};

// An IPv6 prefix, `a/n` per RFC 4291 §2.3, with every bit past the prefix length zero.
const isIpv6PrefixText = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const at = value.indexOf('/');
  const length =
    at !== -1 && readIpv6(value, 0, at, scratch) ? prefixLengthOf(value, at + 1, 128) : -1;

  return length !== -1 && hostBitsZero(scratch, 8, length);
};

/**
 * Internal: whether a value is an IPv4 or IPv6 prefix.
 */
export const isIpPrefixText = (value: unknown): value is string =>
  isIpv4PrefixText(value) || isIpv6PrefixText(value);

/**
 * Internal: the network of prefix text a type has already accepted.
 */
export const networkOf = (text: string): IpNetwork => {
  const at = text.indexOf('/');

  return { bits: bitsOf(text, at), length: Number(text.slice(at + 1)) };
};

/**
 * Internal: prefix text with its address written as RFC 5952 recommends.
 */
export const canonicalPrefix = (text: string): string => {
  const network = networkOf(text);

  return `${textOf(network.bits)}/${String(network.length)}`;
};
