import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { inOneLine } from '../../core/same-value.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';

const alphanumeric = '[A-Za-z0-9]';
const languageSubtag = '[A-Za-z]{2,3}';
const scriptSubtag = '[A-Za-z]{4}';
const regionSubtag = '(?:[A-Za-z]{2}|[0-9]{3})';
const variantSubtag = `(?:${alphanumeric}{5,8}|[0-9]${alphanumeric}{3})`;
const languageId = `${languageSubtag}(?:-${scriptSubtag})?(?:-${regionSubtag})?(?:-${variantSubtag})*`;
const keyword = `${alphanumeric}[A-Za-z](?:-${alphanumeric}{3,8})*`;
const unicodeExtension = `[Uu](?:(?:-${alphanumeric}{3,8})+(?:-${keyword})*|(?:-${keyword})+)`;
const field = `[A-Za-z][0-9](?:-${alphanumeric}{3,8})+`;
const transformedExtension = `[Tt](?:-${languageId}(?:-${field})*|(?:-${field})+)`;
const otherExtension = `[0-9A-SVWYZa-svwyz](?:-${alphanumeric}{2,8})+`;
const privateUse = `[Xx](?:-${alphanumeric}{1,8})+`;

const pattern = new RegExp(
  `^${languageId}(?:-(?:${unicodeExtension}|${transformedExtension}|${otherExtension}))*(?:-${privateUse})?$`,
  'u',
);

const isVariant = (subtag: string): boolean =>
  subtag.length > 4 || (subtag.length === 4 && /^\d/u.test(subtag));

const isScript = (subtag: string | undefined): subtag is string =>
  subtag !== undefined && /^[A-Za-z]{4}$/u.test(subtag);

const isFieldKey = (subtag: string): boolean => /^[a-z]\d$/u.test(subtag);

// RFC 5646 and Unicode both refuse a variant or an extension written twice, which a pattern
// cannot see. Private use comes last and may repeat anything.
const repeats = (tag: string): boolean => {
  const singletons = new Set<string>();
  let variants = new Set<string>();
  let inLanguage = true;

  for (const subtag of tag.toLowerCase().split('-').slice(1)) {
    if (subtag === 'x') {
      return false;
    }

    if (subtag.length === 1) {
      if (singletons.has(subtag)) {
        return true;
      }

      singletons.add(subtag);
      variants = new Set();
      inLanguage = subtag === 't';
    } else if (inLanguage && isFieldKey(subtag)) {
      inLanguage = false;
    } else if (inLanguage && isVariant(subtag)) {
      if (variants.has(subtag)) {
        return true;
      }

      variants.add(subtag);
    }
  }

  return false;
};

const isLanguageTag = (value: unknown): value is string =>
  typeof value === 'string' && pattern.test(value) && !repeats(value);

const LanguageTagBase: SubtypeOf<
  typeof AnyString,
  'nominal.LanguageTag',
  string,
  typeof NonBlankString
> = AnyString.subtype(
  'nominal.LanguageTag',
  stringOnly(
    satisfying(isLanguageTag, 'a BCP 47 language tag', {
      type: 'string',
      pattern: pattern.source,
      examples: ['en-US'],
    }),
  ),
  { implies: [nonBlankString] },
);

/**
 * A language tag as BCP 47 (RFC 5646) writes it, such as `en`, `en-US` or `zh-Hant-TW`, for the
 * language of a user, a text or a translation.
 *
 * @remarks
 * The tag has to be well-formed and a Unicode BCP 47 locale identifier as well, so `Intl` takes
 * every value. The language is two or three letters; extended languages (`zh-yue`, write `yue`),
 * the irregular grandfathered tags (`i-klingon`) and tags of private use alone (`x-mine`) are
 * refused. The check is the package's own and does not depend on the runtime. Whether a subtag is
 * registered is not checked, so `xx-YY` passes. Case is free and kept as given; `equals` ignores
 * it.
 *
 * @example
 * ```ts
 * import { LanguageTag } from '@horizon-republic/nominal-types';
 *
 * const tag = new LanguageTag('ZH-hant-tw');
 * tag.region; // 'TW'
 * tag.canonical().value; // 'zh-Hant-TW'
 * ```
 */
export class LanguageTag extends LanguageTagBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof LanguageTag>;

  /**
   * The grammar of a tag, without the check for a variant or extension written twice.
   *
   * @remarks
   * The JSON Schema carries it as its `pattern`, so a schema validator also takes a tag that
   * repeats a variant or an extension, such as `de-1996-1996`.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The language subtag in lower case, such as `en`.
   */
  public get language(): string {
    const [language = ''] = this.#subtags();

    return language.toLowerCase();
  }

  /**
   * The script subtag in title case, such as `Hant`, or `undefined` when the tag names none.
   */
  public get script(): string | undefined {
    const script = this.#subtags()[1];

    return isScript(script)
      ? script.charAt(0).toUpperCase() + script.slice(1).toLowerCase()
      : undefined;
  }

  /**
   * The region subtag in upper case, such as `US` or `419`, or `undefined` when the tag names none.
   */
  public get region(): string | undefined {
    const [, second, third] = this.#subtags();
    const region = isScript(second) ? third : second;

    return region !== undefined && region.length <= 3 ? region.toUpperCase() : undefined;
  }

  /**
   * The tag as `Intl.getCanonicalLocales()` writes it: subtags in their usual case and aliases
   * replaced, so `EN-us` gives `en-US` and `iw` gives `he`.
   *
   * @remarks
   * The aliases come from the runtime's Unicode data, so a newer runtime may replace more of them.
   *
   * @returns A tag of the same class.
   * @throws {@link NominalError} when a subtype's own rule refuses the canonical form.
   */
  public canonical(): this {
    const [canonical = this.value] = Intl.getCanonicalLocales(this.value);

    return sameType(this, canonical);
  }

  /**
   * Whether the other value is the same tag, ignoring case, and belongs to this type, a type under
   * it or the type it is under, like `equals()` on every type.
   *
   * @param other - The value to compare with.
   * @returns `true` when both are the same tag.
   */
  public override equals(other: unknown): boolean {
    return other instanceof LanguageTag
      ? inOneLine(this, other) && other.value.toLowerCase() === this.value.toLowerCase()
      : super.equals(other);
  }

  #subtags(): string[] {
    const end = this.value.search(/-.(?:-|$)/u);

    return (end === -1 ? this.value : this.value.slice(0, end)).split('-');
  }
}
