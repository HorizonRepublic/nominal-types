import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { sameType } from '../../core/same-type.ts';
import { inOneLine } from '../../core/same-value.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';

const name = '[\\dA-Za-z][\\dA-Za-z!#$&^_.+\\-]{0,126}';
const token = "[\\dA-Za-z!#$%&'*+.^_`|~\\-]+";
const quoted = '"(?:[\\t !\\x23-\\x5B\\x5D-\\x7E\\x80-\\xFF]|\\\\[\\t \\x21-\\x7E\\x80-\\xFF])*"';
const parameter = `[\\t ]*;[\\t ]*${token}=(?:${token}|${quoted})`;
const pattern = new RegExp(`^${name}/${name}(?:${parameter})*$`, 'u');
const tokenPattern = new RegExp(`^${token}$`, 'u');

const isWhitespace = (code: number | undefined): boolean => code === 32 || code === 9;

// Where a run of token characters starting at `index` ends: at a space, a tab, a `;` or the end.
const tokenEnd = (text: string, index: number): number => {
  let end = index;

  while (
    end < text.length &&
    text.codePointAt(end) !== 59 &&
    !isWhitespace(text.codePointAt(end))
  ) {
    end++;
  }

  return end;
};

const unquote = (text: string, start: number): { value: string; end: number } => {
  let value = '';
  let from = start + 1;
  let index = from;

  while (text.codePointAt(index) !== 34) {
    if (text.codePointAt(index) === 92) {
      value += text.slice(from, index);
      from = index + 1;
      index++;
    }

    index++;
  }

  return { value: value + text.slice(from, index), end: index + 1 };
};

// Reads the parameters of a text the pattern accepted, so every `;` it meets outside a quoted
// string starts a `name=value` pair.
const parametersOf = (text: string): Array<readonly [string, string]> => {
  const pairs: Array<readonly [string, string]> = [];
  let index = text.indexOf(';');

  while (index !== -1) {
    index++;

    while (isWhitespace(text.codePointAt(index))) {
      index++;
    }

    const equals = text.indexOf('=', index);
    const key = text.slice(index, equals).toLowerCase();

    if (text.codePointAt(equals + 1) === 34) {
      const { value, end } = unquote(text, equals + 1);

      pairs.push([key, value]);
      index = end;
    } else {
      index = tokenEnd(text, equals + 1);
      pairs.push([key, text.slice(equals + 1, index)]);
    }

    index = text.indexOf(';', index);
  }

  return pairs;
};

// Where the quoted string opening at `start` closes, past its escaped characters.
const quoteEnd = (text: string, start: number): number => {
  let index = start + 1;

  while (text.codePointAt(index) !== 34) {
    index += text.codePointAt(index) === 92 ? 2 : 1;
  }

  return index + 1;
};

// Reads the names alone, leaving the values uncopied.
const hasDistinctNames = (text: string): boolean => {
  let index = text.indexOf(';');

  if (index === text.lastIndexOf(';')) {
    return true;
  }

  const names = new Set<string>();

  while (index !== -1) {
    index++;

    while (isWhitespace(text.codePointAt(index))) {
      index++;
    }

    const equals = text.indexOf('=', index);
    const key = text.slice(index, equals).toLowerCase();

    if (names.has(key)) {
      return false;
    }

    names.add(key);
    index = text.codePointAt(equals + 1) === 34 ? quoteEnd(text, equals + 1) : equals + 1;
    index = text.indexOf(';', index);
  }

  return true;
};

const isMediaType = (value: unknown): value is string =>
  typeof value === 'string' && pattern.test(value) && hasDistinctNames(value);

const MediaTypeBase: SubtypeOf<typeof AnyString, 'nominal.MediaType'> = AnyString.subtype(
  'nominal.MediaType',
  stringOnly(
    satisfying(isMediaType, 'a media type', {
      type: 'string',
      pattern: pattern.source,
      minLength: 3,
      examples: ['application/json', 'text/plain; charset=utf-8'],
    }),
  ),
);

/**
 * A media type such as `text/html; charset=utf-8`, the `Content-Type` of a body or a file.
 *
 * @remarks
 * The type and subtype are names as RFC 6838 §4.2 defines them: a letter or digit, then up to 126
 * of `A-Za-z0-9!#$&-^_.+`. Parameters follow RFC 9110 §8.3.1, `;` then `name=value` with the value
 * a token or a quoted string, and RFC 6838 §4.3 refuses a name given twice. Wildcards such as
 * `text/*` belong to `Accept` headers and are refused. The JSON Schema pattern cannot tell a repeated
 * parameter name, so it is the one value the schema accepts and the type refuses.
 *
 * Type, subtype and parameter names are compared without case, and a quoted value equals the same
 * token unquoted; `canonical()` writes that form, and `equals` compares it.
 *
 * @example
 * ```ts
 * const type = new MediaType('Application/LD+JSON; Charset="utf-8"');
 * type.essence; // 'application/ld+json'
 * type.suffix; // 'JSON'
 * type.canonical().value; // 'application/ld+json;charset=utf-8'
 * ```
 */
export class MediaType extends MediaTypeBase {
  /**
   * The whole media type, parameters included.
   *
   * @remarks
   * The pattern alone lets a parameter name repeat; the rule refuses that on top of it. The rule
   * is built once, when the class is defined, so a subclass that changes the pattern overrides
   * `rule` as well.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The top-level type as written, such as `text` or `application`.
   */
  public get type(): string {
    return this.value.slice(0, this.value.indexOf('/'));
  }

  /**
   * The subtype as written, such as `html` or `ld+json`.
   */
  public get subtype(): string {
    const start = this.value.indexOf('/') + 1;

    return this.value.slice(start, tokenEnd(this.value, start));
  }

  /**
   * The structured syntax suffix of RFC 6839 as written, without its `+`: `json` for
   * `application/ld+json`; `undefined` when the subtype has none.
   */
  public get suffix(): string | undefined {
    const subtype = this.subtype;
    const plus = subtype.lastIndexOf('+');

    return plus === -1 || plus === subtype.length - 1 ? undefined : subtype.slice(plus + 1);
  }

  /**
   * The type and subtype in lowercase, without parameters, for comparing kinds of content.
   */
  public get essence(): string {
    return `${this.type}/${this.subtype}`.toLowerCase();
  }

  /**
   * A fresh map of the parameters, by lowercase name, with quoted values unquoted.
   */
  public get parameters(): ReadonlyMap<string, string> {
    return new Map(parametersOf(this.value));
  }

  /**
   * The `charset` parameter as written, or `undefined` when there is none.
   */
  public get charset(): string | undefined {
    return this.parameters.get('charset');
  }

  /**
   * Whether the content is JSON: `application/json`, or any subtype with the `+json` suffix.
   */
  public get isJson(): boolean {
    return this.essence === 'application/json' || this.suffix?.toLowerCase() === 'json';
  }

  /**
   * The same media type with type, subtype and parameter names lowered, no spaces, and values
   * quoted only where a token cannot carry them.
   */
  public canonical(): this {
    let text = this.essence;

    for (const [key, value] of parametersOf(this.value)) {
      const written = tokenPattern.test(value) ? value : `"${value.replaceAll(/["\\]/gu, '\\$&')}"`;

      text += `;${key}=${written}`;
    }

    return sameType(this, text);
  }

  /**
   * Whether the other value is the same media type once case, spaces and quoting are set aside,
   * and belongs to this type, a type under it or the type it is under, like `equals()` on every
   * type.
   */
  public override equals(other: unknown): boolean {
    return (
      inOneLine(this, other) &&
      other instanceof MediaType &&
      other.canonical().value === this.canonical().value
    );
  }
}
