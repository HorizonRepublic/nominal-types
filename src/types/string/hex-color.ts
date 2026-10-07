import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import { inOneLine } from '../../core/same-value.ts';
import { AnyString } from './any-string.ts';

const pattern = /^#(?:[\dA-Fa-f]{3,4}|[\dA-Fa-f]{6}|[\dA-Fa-f]{8})$/u;

const HexColorBase: SubtypeOf<typeof AnyString, 'nominal.HexColor'> = AnyString.subtype(
  'nominal.HexColor',
  matching(pattern, 'a hex color', {
    minLength: 4,
    maxLength: 9,
    examples: ['#1e90ff'],
  }),
);

/**
 * A color in the hex notation of CSS Color Module Level 4 §5.2: `#` and 3, 4, 6 or 8 hex digits.
 *
 * @remarks
 * The `#` is required, so `'fff'` and `'6633FF'` are refused. Digits may come in either case and
 * are kept as written; `canonical()` gives the lowercase six- or eight-digit form, and `equals`
 * compares the channels, so `#FFF` equals `#ffffff`.
 *
 * @example
 * ```ts
 * const color = new HexColor('#1E90FF80');
 * color.red; // 30
 * color.canonical().value; // '#1e90ff80'
 * ```
 */
export class HexColor extends HexColorBase {
  /**
   * `#` and 3, 4, 6 or 8 hex digits, in either case.
   *
   * @remarks
   * The rule is built from it once, when the class is defined, so a subclass that changes the
   * pattern overrides `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The red channel, from 0 to 255.
   */
  public get red(): number {
    return this.channel(0);
  }

  /**
   * The green channel, from 0 to 255.
   */
  public get green(): number {
    return this.channel(1);
  }

  /**
   * The blue channel, from 0 to 255.
   */
  public get blue(): number {
    return this.channel(2);
  }

  /**
   * The opacity, from 0 (transparent) to 1 (opaque); 1 when the color has no alpha digits.
   */
  public get alpha(): number {
    return this.hasAlpha ? this.channel(3) / 255 : 1;
  }

  /**
   * The same color as `#` and six lowercase digits, or eight when it is not fully opaque.
   */
  public canonical(): HexColor {
    const hex = (index: number): string => this.channel(index).toString(16).padStart(2, '0');
    const opaque = !this.hasAlpha || this.channel(3) === 255;

    return new HexColor(`#${hex(0)}${hex(1)}${hex(2)}${opaque ? '' : hex(3)}`);
  }

  /**
   * Whether the other value has the same channels, whatever its notation, and belongs to this
   * type, a type under it or the type it is under, like `equals()` on every type.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) &&
      other instanceof HexColor &&
      other.canonical().value === this.canonical().value
    );
  }

  private get hasAlpha(): boolean {
    return this.value.length === 5 || this.value.length === 9;
  }

  private channel(index: number): number {
    const short = this.value.length <= 5;
    const digits = short
      ? this.value.charAt(index + 1).repeat(2)
      : this.value.slice(index * 2 + 1, index * 2 + 3);

    return Number.parseInt(digits, 16);
  }
}
