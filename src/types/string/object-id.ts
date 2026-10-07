import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import { inOneLine } from '../../core/same-value.ts';
import { AnyString } from './any-string.ts';

const pattern = /^[\dA-Fa-f]{24}$/u;

const ObjectIdBase: SubtypeOf<typeof AnyString, 'nominal.ObjectId'> = AnyString.subtype(
  'nominal.ObjectId',
  matching(pattern, 'an ObjectId', {
    minLength: 24,
    maxLength: 24,
    examples: ['507f1f77bcf86cd799439011'],
  }),
);

/**
 * A MongoDB ObjectId as 24 hex digits: 12 bytes, of which the first four are the time it was made
 * in seconds, as the BSON specification lays them out.
 *
 * @remarks
 * Every 12 bytes form an ObjectId, all zeros included. Hex digits may come in either case and are
 * kept as written; `equals` ignores case, and `canonical()` gives the lowercase form MongoDB
 * writes.
 *
 * @example
 * ```ts
 * const id = new ObjectId('507f1f77bcf86cd799439011');
 * id.timestamp; // 2012-10-17T21:13:27.000Z
 * ```
 */
export class ObjectId extends ObjectIdBase {
  /**
   * Twenty-four hex digits in either case.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The moment the ObjectId was made, to the second, read from its first eight digits.
   */
  public get timestamp(): Date {
    return new Date(Number.parseInt(this.value.slice(0, 8), 16) * 1000);
  }

  /**
   * The same ObjectId in lowercase.
   */
  public canonical(): ObjectId {
    return new ObjectId(this.value.toLowerCase());
  }

  /**
   * Whether the other value has the same digits, ignoring case, and belongs to this type, a type
   * under it or the type it is under, like `equals()` on every type.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) &&
      other instanceof ObjectId &&
      other.value.toLowerCase() === this.value.toLowerCase()
    );
  }
}
