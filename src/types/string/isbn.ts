import type { SubtypeOf } from '../../core/contracts.ts';
import { sameType } from '../../core/same-type.ts';
import { inOneLine } from '../../core/same-value.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import {
  gs1CheckDigit,
  hasGs1CheckDigit,
  hasMod11CheckCharacter,
  mod11CheckCharacter,
} from './check-digits.ts';
import { IsbnRule } from './isbn-rule.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';

// 979-0 belongs to the ISMN of printed music, so an ISBN-13 starts with 978 or 979-1 to 979-9.
const pattern = /^(?:\d{9}[\dX]|97(?:8\d|9[1-9])\d{9})$/u;

const isIsbnText = (value: unknown): value is string =>
  typeof value === 'string' &&
  pattern.test(value) &&
  (value.length === 10 ? hasMod11CheckCharacter(value) : hasGs1CheckDigit(value));

const IsbnBase: SubtypeOf<typeof AnyString, 'nominal.Isbn', string, typeof NonBlankString> =
  AnyString.subtype(
    'nominal.Isbn',
    stringOnly(
      new IsbnRule(isIsbnText, 'an ISBN with a valid check digit', {
        type: 'string',
        pattern: pattern.source,
        minLength: 10,
        maxLength: 13,
        examples: ['9780306406157', '0306406152'],
      }),
    ),
    { implies: [nonBlankString] },
  );

const isbn13Of = (text: string): string => {
  if (text.length === 13) {
    return text;
  }

  const body = `978${text.slice(0, 9)}`;

  return body + gs1CheckDigit(body);
};

/**
 * An International Standard Book Number of ISO 2108, such as `9780306406157`: an ISBN-13, or an
 * ISBN-10 as books printed before 2007 carry it, with its check digit.
 *
 * @remarks
 * The value is the compact form, digits only, with an uppercase `X` as the check character of an
 * ISBN-10. Hyphens and spaces are refused rather than dropped, since where they belong depends on
 * the ISBN range table; remove them before parsing. An ISBN-13 starts with 978 or 979, and not with
 * 979-0, which ISMN uses for printed music. An ISBN-10 and the ISBN-13 it converts to are one
 * ISBN: `equals` holds between them, and `canonical()` gives the ISBN-13.
 *
 * @example
 * ```ts
 * import { Isbn } from '@horizon-republic/nominal-types';
 *
 * const isbn = new Isbn('0306406152');
 * isbn.canonical().value; // '9780306406157'
 * isbn.equals(new Isbn('9780306406157')); // true
 * ```
 */
export class Isbn extends IsbnBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Isbn>;

  /**
   * The shape of an ISBN-10 or an ISBN-13 in its compact form, which the JSON Schema carries; the
   * check digit is checked apart from it.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The number of characters: 10 for an ISBN-10, 13 for an ISBN-13.
   */
  public get format(): 10 | 13 {
    return this.value.length === 10 ? 10 : 13;
  }

  /**
   * The ISBN-13 form, the one ISO 2108 assigns since 2007; an ISBN-13 stays as it is.
   *
   * @returns An ISBN of the same class, 13 digits long.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public canonical(): this {
    return sameType(this, isbn13Of(this.value));
  }

  /**
   * The ISBN-10 form, for systems that still take it.
   *
   * @returns An `Isbn` of 10 characters, or `undefined` for an ISBN-13 starting with 979, which has
   * none.
   */
  public toIsbn10(): Isbn | undefined {
    if (this.value.length === 10) {
      // @throws-ignore the value is a valid ISBN already
      return new Isbn(this.value);
    }

    if (!this.value.startsWith('978')) {
      return undefined;
    }

    const body = this.value.slice(3, 12);

    // @throws-ignore nine digits of a valid ISBN-13 and their check character make a valid ISBN-10
    return new Isbn(body + mod11CheckCharacter(body));
  }

  /**
   * Whether the other value is the same ISBN, as an ISBN-10 or an ISBN-13, and belongs to this
   * type, a type under it or the type it is under, like `equals()` on every type.
   *
   * @param other - The value to compare with.
   * @returns `true` when both are the same ISBN.
   */
  public override equals(other: unknown): boolean {
    return other instanceof Isbn
      ? inOneLine(this, other) && isbn13Of(other.value) === isbn13Of(this.value)
      : super.equals(other);
  }
}
