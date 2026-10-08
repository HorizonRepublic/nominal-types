import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { inOneLine } from '../../core/same-value.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
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
 * import { ObjectId } from '@horizon-republic/nominal-types';
 *
 * const id = new ObjectId('507f1f77bcf86cd799439011');
 * id.timestamp; // 2012-10-17T21:13:27.000Z
 * ```
 */
export class ObjectId extends ObjectIdBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof ObjectId>;

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
   *
   * @returns An ObjectId of the same class.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public canonical(): this {
    return sameType(this, this.value.toLowerCase());
  }

  /**
   * Whether the other value has the same digits, ignoring case, and belongs to this type, a type
   * under it or the type it is under, like `equals()` on every type.
   *
   * @param other - The value to compare with.
   * @returns `true` when both are the same ObjectId.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) &&
      other instanceof ObjectId &&
      other.value.toLowerCase() === this.value.toLowerCase()
    );
  }
}
