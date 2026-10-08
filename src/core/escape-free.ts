import type { NominalSchema } from './contracts.ts';
import { rulesOf } from './hierarchy.ts';
import { NativeSchema } from './native-schema.ts';
import { PatternSchema } from './pattern-schema.ts';
import { isClashed } from './registry.ts';

// Built-in types whose rule is a guard rather than a pattern, and whose text never holds `"`, `\`
// or a control character; the tests prove each of them. A subtype or a subclass inherits the rule.
const escapeFreeTypes: ReadonlySet<string> = new Set([
  'nominal.Bic',
  'nominal.CountryCode',
  'nominal.CurrencyCode',
  'nominal.E164PhoneNumber',
  'nominal.Gtin',
  'nominal.Hostname',
  'nominal.Iban',
  'nominal.IpAddress',
  'nominal.IpPrefix',
  'nominal.Isbn',
  'nominal.Isin',
  'nominal.Issn',
  'nominal.Jwt',
  'nominal.LanguageTag',
]);

const isSafeCode = (code: number): boolean =>
  code >= 0x20 && code <= 0x7e && code !== 0x22 && code !== 0x5c;

// One character of a pattern, or an escape such as \d, \x41 or \.
const atoms = /\\(?:x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|.)|./gsu;

// One token of a pattern: an escape, a whole class, the opening of a group, or one character.
const tokens =
  /\\(?:x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|.)|\[(?:\\.|[^\\\]])*\]|\(\?(?:<?[=!]|<[^>]*>|:)?|./gsu;

const lookaround = /^\(\?<?[=!]/u;

// The character an atom stands for; -1 for \d and \w, whose characters are all safe; NaN for an
// escape that may stand for an unsafe one, such as \s, \b in a class, or \\.
const codeOf = (atom: string): number => {
  if (!atom.startsWith('\\')) {
    return atom.codePointAt(0) ?? Number.NaN;
  }

  const name = atom.slice(1);

  if (name === 'd' || name === 'w') {
    return -1;
  }

  if (name.length > 1) {
    return Number.parseInt(name.slice(1), 16);
  }

  return '^$.*+?()[]{}|/-'.includes(name) ? (name.codePointAt(0) ?? Number.NaN) : Number.NaN;
};

const isSafeRange = (low: number, high: number): boolean =>
  isSafeCode(low) &&
  isSafeCode(high) &&
  low <= high &&
  (high < 0x22 || low > 0x22) &&
  (high < 0x5c || low > 0x5c);

const isSafeClass = (body: string): boolean => {
  const items = body.match(atoms) ?? [];

  if (body.startsWith('^')) {
    return false;
  }

  for (let at = 0; at < items.length; at += 1) {
    const low = codeOf(items[at] ?? '');
    const range = items[at + 1] === '-' && at + 2 < items.length;

    if (range ? !isSafeRange(low, codeOf(items[at + 2] ?? '')) : low !== -1 && !isSafeCode(low)) {
      return false;
    }

    at += range ? 2 : 0;
  }

  return true;
};

const isSafeToken = (token: string, depth: number): boolean => {
  if (token.startsWith('[')) {
    return isSafeClass(token.slice(1, -1));
  }

  const code = codeOf(token);

  return (
    token === '\\b' ||
    token === '\\B' ||
    (token !== '.' && (token !== '|' || depth > 0) && (code === -1 || isSafeCode(code)))
  );
};

/**
 * Internal: whether every string a pattern matches is free of `"`, `\`, control characters and
 * anything beyond printable ASCII, so it is written to JSON between quotes as it is.
 *
 * @remarks
 * The proof is conservative: the pattern has to match the whole string, `^` to `$` with no `|`
 * outside a group, and every character it can consume has to be safe. Lookarounds consume nothing,
 * so their content doesn't count. Anything the scan doesn't know, such as `.`, a negated class or
 * a backreference, fails the proof.
 */
export const provesEscapeFree = ({ source, flags }: RegExp): boolean => {
  const found = source.match(tokens) ?? [];
  let depth = 0;
  // The depth a lookaround opened at, or 0 outside one.
  let around = 0;

  if ((flags !== '' && flags !== 'u') || found[0] !== '^' || found.at(-1) !== '$') {
    return false;
  }

  for (const token of found.slice(1, -1)) {
    if (token.startsWith('(')) {
      depth += 1;
      around ||= lookaround.test(token) ? depth : 0;
    } else if (token === ')') {
      around = around === depth ? 0 : around;
      depth -= 1;
    } else if (around === 0 && !isSafeToken(token, depth)) {
      return false;
    }
  }

  return depth === 0;
};

const ownRule = (level: object): unknown =>
  Object.hasOwn(level, 'rule') ? Reflect.get(level, 'rule') : undefined;

// The rules of declared escape-free built-in types on the way from `target` up to the root.
const namedRules = (root: object, target: object): Set<unknown> => {
  const rules = new Set<unknown>();
  let level: unknown = target;

  while (typeof level === 'function' && level !== root) {
    const name: unknown = Object.hasOwn(level, 'typeName')
      ? Reflect.get(level, 'typeName')
      : undefined;

    if (typeof name === 'string' && escapeFreeTypes.has(name) && !isClashed(name)) {
      rules.add(ownRule(level));
    }

    level = Object.getPrototypeOf(level);
  }

  return rules;
};

// The rules that check the value a type ends up holding: those after the last rule from another
// library, which may change the value.
const finalChecks = (rules: readonly NominalSchema[]): readonly NominalSchema[] => {
  const last = rules.findLastIndex((rule) => !(rule instanceof NativeSchema));

  return rules.slice(last + 1);
};

/**
 * Internal: whether a type of this copy of the package holds only strings that need no escaping
 * in JSON: one of its final rules is a pattern `provesEscapeFree()` accepts, or the rule of a
 * built-in type known to be escape-free.
 */
export const holdsEscapeFreeText = (root: object, target: object): boolean => {
  const named = namedRules(root, target);

  return finalChecks(rulesOf(root, target)).some(
    (rule) => named.has(rule) || (rule instanceof PatternSchema && provesEscapeFree(rule.pattern)),
  );
};
