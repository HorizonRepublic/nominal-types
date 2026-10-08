import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyString } from './any-string.ts';
import { decodeBase64, decodedLength } from './base64-decode.ts';

const digit = '[\\dA-Za-z_-]';

// Four classes rather than `{4}`: V8 runs a group of them as a plain loop, while a counted group
// keeps backtracking state for every repetition and throws a RangeError on a few megabytes of text.
const pattern = new RegExp(
  `^(?:${digit}${digit}${digit}${digit})*(?:${digit}[AQgw]|${digit}${digit}[048AEIMQUYcgkosw])?$`,
  'u',
);

const Base64UrlBase: SubtypeOf<typeof AnyString, 'nominal.Base64Url'> = AnyString.subtype(
  'nominal.Base64Url',
  matching(pattern, 'base64url text', {
    contentEncoding: 'base64url',
    examples: ['aGVsbG8'],
  }),
);

/**
 * Bytes written as text in the URL- and file-name-safe base64 encoding of RFC 4648 §5, with its
 * `-_` alphabet and no padding, as JWTs and other tokens carry it.
 *
 * @remarks
 * A sibling of `Base64`, not a subtype: the alphabets differ, so neither accepts all of the
 * other's texts. Padding is refused, as RFC 7515 §2 writes this encoding, and the bits the last
 * character pads must be zero, so one byte string has one text and `equals` compares bytes. The
 * empty string is the encoding of zero bytes and passes.
 *
 * @example
 * ```ts
 * const token = new Base64Url('aGVsbG8');
 * token.byteLength; // 5
 * new TextDecoder().decode(token.toBytes()); // 'hello'
 * ```
 */
export class Base64Url extends Base64UrlBase {
  declare public static readonly '~standard': StandardOf<typeof Base64Url>;

  /**
   * Groups of four alphabet characters, and a shorter last group whose pad bits are zero.
   *
   * @remarks
   * The rule is built from it once, when the class is defined, so a subclass that changes the
   * pattern overrides `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The number of bytes the text encodes.
   */
  public get byteLength(): number {
    return decodedLength(this.value);
  }

  /**
   * The bytes the text encodes, in a new array the caller may change.
   */
  public toBytes(): Uint8Array {
    return decodeBase64(this.value, 'base64url');
  }
}
