import type { NominalType } from '../core/contracts.ts';
import { Nominal } from '../core/nominal.ts';
import { matching } from '../core/pattern-schema.ts';
import type { PatternSchema } from '../core/pattern-schema.ts';

const declaredBelow = /(?!)/u;

const UuidBase: NominalType<'Uuid', PatternSchema> = Nominal('Uuid', matching(declaredBelow));

/**
 * A UUID in its canonical 8-4-4-4-12 text form, any version from 1 to 8 plus the nil and max
 * values.
 *
 * @remarks
 * Hex digits may come in either case and are kept as written; `equals` ignores case, and
 * `canonical()` gives the lowercase form RFC 9562 recommends for output.
 */
export class Uuid extends UuidBase {
  /**
   * Versions 1 to 8 with the RFC 9562 variant, or the nil and max values, in either case.
   *
   * @remarks
   * Case is spelled out in the character classes rather than with the `i` flag, because JSON Schema
   * patterns carry no flags and the generated schema has to accept what the type accepts. The
   * schema is built from it once, when the class is defined, so a subclass that changes the pattern
   * overrides `schema` as well.
   */
  public static readonly pattern: RegExp =
    /^(?:[\dA-Fa-f]{8}-[\dA-Fa-f]{4}-[1-8][\dA-Fa-f]{3}-[89ABab][\dA-Fa-f]{3}-[\dA-Fa-f]{12}|0{8}-0{4}-0{4}-0{4}-0{12}|[Ff]{8}-[Ff]{4}-[Ff]{4}-[Ff]{4}-[Ff]{12})$/u;

  public static override readonly schema: PatternSchema = matching(this.pattern, 'a UUID');

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
   */
  public canonical(): Uuid {
    return new Uuid(this.value.toLowerCase());
  }

  /**
   * Whether the other value is a Uuid with the same digits, ignoring case.
   */
  public override equals(other: unknown): boolean {
    return other instanceof Uuid && other.value.toLowerCase() === this.value.toLowerCase();
  }
}
