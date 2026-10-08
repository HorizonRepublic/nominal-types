import { decodePunycode, encodePunycode } from './punycode.ts';

/**
 * One LDH label as a pattern fragment, letters, digits and inner hyphens, up to 63
 * characters; `Email` builds its domain from it too.
 *
 * @internal
 */
export const labelFragment = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';

const end = '[A-Za-z0-9]';
const inner = '[A-Za-z0-9-]';

// A label with hyphens in its third and fourth places is reserved unless it starts with xn--.
// Written without lookaheads for RE2-based JSON Schema tools: one or two characters, an xn- label,
// or two other characters followed by anything that doesn't start with two hyphens.
const hostLabel =
  `(?:${end}{1,2}|[Xx][Nn]${inner}{0,60}${end}|` +
  `(?:[A-WYZa-wyz0-9]${inner}|[Xx][A-MO-Za-mo-z0-9-])` +
  `(?:${end}(?:${inner}{0,59}${end})?|-${end}(?:${inner}{0,58}${end})?))`;

/**
 * A host name as a pattern, for JSON Schema, with the length limits left to `minLength`
 * and `maxLength`; the runtime check also decodes `xn--` labels, which a pattern cannot.
 *
 * @internal
 */
export const hostnamePattern: RegExp = new RegExp(`^(?:${hostLabel}\\.)*${hostLabel}$`, 'u');

/**
 * A host name whose last label is all digits, which a host name never is, as a pattern
 * for the `not` of a JSON Schema.
 *
 * @internal
 */
export const digitsLastPattern: RegExp = /(?:^|\.)[0-9]+$/u;

/**
 * The top-level label `DomainName` requires, as a pattern searched from the last dot.
 *
 * @internal
 */
export const topLevelPattern: RegExp = /\.(?:[A-Za-z]{2,63}|[Xx][Nn]--[A-Za-z0-9-]{1,59})$/u;

const hyphen = 45;
const dot = 46;

const codeAt = (text: string, index: number): number => text.codePointAt(index) ?? -1;

const isLetter = (code: number): boolean => {
  const lower = code | 0x20;

  return lower >= 97 && lower <= 122;
};

const isDigit = (code: number): boolean => code >= 48 && code <= 57;

// IDNA2008 needs tables this package doesn't carry; lowercase or uncased letters, marks and digits
// that NFKC leaves alone come closest without them. Its bidi and contextual rules are not checked.
const uLabelPoint = /^[\p{Ll}\p{Lo}\p{Lm}\p{Mn}\p{Mc}\p{Nd}-]+$/u;
const leadingMark = /^\p{M}/u;

const isULabel = (label: string): boolean =>
  uLabelPoint.test(label) &&
  !leadingMark.test(label) &&
  !label.startsWith('-') &&
  !label.endsWith('-') &&
  !/^[^]{2}--/u.test(label) &&
  label.normalize('NFKC') === label;

/**
 * The U-label an A-label stands for, or `undefined` when the text after `xn--` is not
 * the Punycode of a valid one (RFC 5891 §5.4): it decodes, has a character outside ASCII, encodes
 * back to the same text and passes the checks of `isULabel`.
 *
 * @internal
 */
export const uLabelOf = (aLabel: string): string | undefined => {
  const encoded = aLabel.slice(4).toLowerCase();
  const points = decodePunycode(encoded);

  if (points === undefined || points.every((point) => point < 128)) {
    return undefined;
  }

  const label = String.fromCodePoint(...points);

  return encodePunycode(points) === encoded && isULabel(label) ? label : undefined;
};

const isLabel = (text: string, from: number, to: number): boolean => {
  if (to === from || to - from > 63) {
    return false;
  }

  if (codeAt(text, from) === hyphen || codeAt(text, to - 1) === hyphen) {
    return false;
  }

  if (to - from < 4 || codeAt(text, from + 2) !== hyphen) {
    return true;
  }

  if (codeAt(text, from + 3) !== hyphen) {
    return true;
  }

  return (
    (codeAt(text, from) | 0x20) === 120 &&
    (codeAt(text, from + 1) | 0x20) === 110 &&
    uLabelOf(text.slice(from, to)) !== undefined
  );
};

/**
 * Whether a value is a host name per RFC 1123 §2.1: LDH labels of 1 to 63 characters
 * joined by dots, 253 characters at most, no trailing dot, a last label that is not all digits,
 * and `xn--` labels that decode.
 *
 * @internal
 */
export const isHostnameText = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 253) {
    return false;
  }

  let start = 0;
  let allDigits = true;

  for (let index = 0; index < value.length; index += 1) {
    const code = codeAt(value, index);

    if (code === dot) {
      if (!isLabel(value, start, index)) {
        return false;
      }

      start = index + 1;
      allDigits = true;
    } else if (!isDigit(code)) {
      if (!isLetter(code) && code !== hyphen) {
        return false;
      }

      allDigits = false;
    }
  }

  return !allDigits && isLabel(value, start, value.length);
};

/**
 * Whether a host name ends in a top-level label of letters, or an A-label, after at
 * least one dot.
 *
 * @internal
 */
export const hasTopLevelText = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const start = value.lastIndexOf('.') + 1;
  const length = value.length - start;

  if (start === 0 || length < 2 || length > 63) {
    return false;
  }

  if (value.slice(start, start + 4).toLowerCase() === 'xn--' && length > 4) {
    return /^[A-Za-z0-9-]+$/u.test(value.slice(start + 4));
  }

  for (let index = start; index < value.length; index += 1) {
    if (!isLetter(codeAt(value, index))) {
      return false;
    }
  }

  return true;
};
