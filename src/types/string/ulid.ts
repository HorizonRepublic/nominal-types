import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { inOneLine } from '../../core/same-value.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyString } from './any-string.ts';

const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const pattern = /^[0-7][\dA-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/u;

const UlidBase: SubtypeOf<typeof AnyString, 'nominal.Ulid'> = AnyString.subtype(
  'nominal.Ulid',
  matching(pattern, 'a ULID', {
    minLength: 26,
    maxLength: 26,
    examples: ['01ARZ3NDEKTSV4RRFFQ69G5FAV'],
  }),
);

/**
 * A ULID as its specification (github.com/ulid/spec) writes it: 26 characters of Crockford's
 * base32, a 48-bit time in milliseconds followed by 80 random bits.
 *
 * @remarks
 * The first character is `0` to `7`, since a larger one would not fit in 128 bits. `I`, `L`, `O`
 * and `U` are refused rather than read as `1`, `1`, `0` and nothing, so one id has one spelling
 * up to case. Letters may come in either case and are kept as written; `equals` ignores case, and
 * `canonical()` gives the uppercase form the specification writes.
 *
 * @example
 * ```ts
 * import { Ulid } from '@horizon-republic/nominal-types';
 *
 * const id = new Ulid('01ARZ3NDEKTSV4RRFFQ69G5FAV');
 * id.timestamp; // 2016-07-30T23:54:10.259Z
 * ```
 */
export class Ulid extends UlidBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Ulid>;

  /**
   * Twenty-six characters of Crockford's base32 in either case, the first one `0` to `7`.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The moment the ULID was made, read from its first ten characters.
   */
  public get timestamp(): Date {
    let milliseconds = 0;

    for (const character of this.value.slice(0, 10).toUpperCase()) {
      milliseconds = milliseconds * 32 + alphabet.indexOf(character);
    }

    return new Date(milliseconds);
  }

  /**
   * The same ULID in uppercase.
   *
   * @returns A ULID of the same class.
   */
  public canonical(): this {
    return sameType(this, this.value.toUpperCase());
  }

  /**
   * Whether the other value has the same characters, ignoring case, and belongs to this type, a
   * type under it or the type it is under, like `equals()` on every type.
   *
   * @param other - The value to compare with.
   * @returns `true` when both are the same ULID.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) &&
      other instanceof Ulid &&
      other.value.toUpperCase() === this.value.toUpperCase()
    );
  }
}
