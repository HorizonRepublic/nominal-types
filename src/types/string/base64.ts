import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyString } from './any-string.ts';
import { decodeBase64, decodedLength } from './base64-decode.ts';

const digit = '[\\d+/A-Za-z]';

// Four classes rather than `{4}`: V8 runs a group of them as a plain loop, while a counted group
// keeps backtracking state for every repetition and throws a RangeError on a few megabytes of text.
const pattern = new RegExp(
  `^(?:${digit}${digit}${digit}${digit})*(?:${digit}[AQgw]==|${digit}${digit}[048AEIMQUYcgkosw]=)?$`,
  'u',
);

const Base64Base: SubtypeOf<typeof AnyString, 'nominal.Base64'> = AnyString.subtype(
  'nominal.Base64',
  matching(pattern, 'base64 text', {
    contentEncoding: 'base64',
    examples: ['aGVsbG8='],
  }),
);

/**
 * Bytes written as text in the base64 encoding of RFC 4648 §4, with its `+/` alphabet and `=`
 * padding.
 *
 * @remarks
 * The text is the canonical encoding of §3.5: padding is required, and the bits it pads must be
 * zero, so one byte string has one text and `equals` compares bytes. Whitespace and line breaks
 * are refused. The empty string is the encoding of zero bytes and passes; declare a subtype with a
 * length rule to refuse it, or to cap the size.
 *
 * @example
 * ```ts
 * import { Base64 } from '@horizon-republic/nominal-types';
 *
 * const data = new Base64('aGVsbG8=');
 * data.byteLength; // 5
 * new TextDecoder().decode(data.toBytes()); // 'hello'
 * ```
 */
export class Base64 extends Base64Base {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Base64>;

  /**
   * Groups of four alphabet characters, and a padded last group whose pad bits are zero.
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
   * The bytes the text encodes.
   *
   * @returns A new array the caller may change.
   */
  public toBytes(): Uint8Array {
    return decodeBase64(this.value, 'base64');
  }
}
