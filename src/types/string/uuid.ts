import type { SubtypeOf } from '../../core/contracts.ts';
import { sameType } from '../../core/same-type.ts';
import { equalityKeySlot, inOneLine } from '../../core/same-value.ts';
import type { EqualityKey } from '../../core/same-value.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyString } from './any-string.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';
import { pattern, uuidRule } from './uuid-rule.ts';

const hasUpperCase = /[A-F]/u;

const UuidBase: SubtypeOf<typeof AnyString, 'nominal.Uuid', string, typeof NonBlankString> =
  AnyString.subtype('nominal.Uuid', uuidRule, { implies: [nonBlankString] });

/**
 * A UUID in its canonical 8-4-4-4-12 text form, any version from 1 to 8 plus the nil and max
 * values.
 *
 * @remarks
 * Hex digits may come in either case and are kept as written; `equals` ignores case, and
 * `canonical()` gives the lowercase form RFC 9562 recommends for output.
 *
 * @example
 * ```ts
 * import { Uuid } from '@horizon-republic/nominal-types';
 *
 * const id = new Uuid('6F1C2A3E-8B9D-4E5F-A1B2-C3D4E5F60718');
 * id.version; // 4
 * id.canonical().value; // '6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718'
 * ```
 */
export class Uuid extends UuidBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Uuid>;

  /**
   * Versions 1 to 8 with the RFC 9562 variant, or the nil and max values, in either case.
   *
   * @remarks
   * Case is spelled out in the character classes rather than with the `i` flag, because JSON Schema
   * patterns carry no flags and the generated schema has to accept what the type accepts. The
   * schema is built from it once, when the class is defined, so a subclass that changes the pattern
   * overrides `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The version digit: 1 to 8, 0 for the nil UUID and 15 for the max UUID.
   */
  public get version(): number {
    return Number.parseInt(this.value.charAt(14), 16);
  }

  /**
   * Whether this is the nil UUID, all zeros.
   */
  public get isNil(): boolean {
    return this.value === '00000000-0000-0000-0000-000000000000';
  }

  /**
   * Whether this is the max UUID, all ones.
   */
  public get isMax(): boolean {
    return this.value.toLowerCase() === 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  }

  /**
   * The moment a version 7 UUID was generated, read from its leading 48 bits; `undefined` for
   * every other version.
   */
  public get timestamp(): Date | undefined {
    if (this.version !== 7) {
      return undefined;
    }

    const hex = this.value.slice(0, 8) + this.value.slice(9, 13);

    return new Date(Number.parseInt(hex, 16));
  }

  /**
   * The same UUID in lowercase.
   *
   * @returns A UUID of the same class.
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
   * @returns `true` when both are the same UUID.
   */
  public override equals(other: unknown): boolean {
    return other instanceof Uuid
      ? inOneLine(this, other) && other.value.toLowerCase() === this.value.toLowerCase()
      : super.equals(other);
  }
}

const uuidEqualityKey: EqualityKey = {
  equals: Reflect.get(Uuid.prototype, 'equals'),
  key: ({ value }) => {
    const text = String(value);

    return hasUpperCase.test(text) ? text.toLowerCase() : text;
  },
};

Object.defineProperty(Uuid.prototype, equalityKeySlot, { value: uuidEqualityKey });
