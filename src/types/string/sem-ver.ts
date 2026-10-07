import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import { AnyString } from './any-string.ts';

// Decimal numbers from 0 to `limit` without leading zeros, as alternatives of a pattern: shorter
// numbers, then each digit of the limit with a smaller one in its place, then the limit itself.
const anyDigits = (count: number): string => {
  if (count === 0) {
    return '';
  }

  return count === 1 ? '\\d' : `\\d{${count}}`;
};

const numbersUpTo = (limit: number): string => {
  const digits = String(limit);
  const sameLength = digits.split('').flatMap((digit, index) => {
    const lowest = index === 0 ? 1 : 0;
    const highest = Number(digit) - 1;
    const smaller = lowest === highest ? String(lowest) : `[${lowest}-${highest}]`;

    if (highest < lowest) {
      return [];
    }

    return [digits.slice(0, index) + smaller + anyDigits(digits.length - index - 1)];
  });

  return ['0', `[1-9]\\d{0,${digits.length - 2}}`, ...sameLength, digits].join('|');
};

const safeNumber = numbersUpTo(Number.MAX_SAFE_INTEGER);
const number = `(?:${safeNumber})`;
const identifier = `(?:${safeNumber}|\\d*[A-Za-z-][\\dA-Za-z-]*)`;
const buildIdentifier = '[\\dA-Za-z-]+';
const pattern = new RegExp(
  `^(?=.{5,256}$)${number}\\.${number}\\.${number}` +
    `(?:-${identifier}(?:\\.${identifier})*)?` +
    `(?:\\+${buildIdentifier}(?:\\.${buildIdentifier})*)?$`,
  'u',
);

const SemVerBase: SubtypeOf<typeof AnyString, 'nominal.SemVer'> = AnyString.subtype(
  'nominal.SemVer',
  matching(pattern, 'a semantic version', {
    minLength: 5,
    maxLength: 256,
    examples: ['1.4.2', '2.0.0-rc.1+build.5'],
  }),
);

interface Parts {
  readonly core: readonly [number, number, number];
  readonly prerelease: ReadonlyArray<string | number>;
  readonly build: readonly string[];
}

const numeric = /^\d+$/u;

const partsOf = (text: string): Parts => {
  const plus = text.indexOf('+');
  const version = plus === -1 ? text : text.slice(0, plus);
  const dash = version.indexOf('-');
  const [major = 0, minor = 0, patch = 0] = (dash === -1 ? version : version.slice(0, dash))
    .split('.')
    .map(Number);

  return {
    core: [major, minor, patch],
    prerelease:
      dash === -1
        ? []
        : version
            .slice(dash + 1)
            .split('.')
            .map((part) => (numeric.test(part) ? Number(part) : part)),
    build: plus === -1 ? [] : text.slice(plus + 1).split('.'),
  };
};

const order = (left: string | number, right: string | number): -1 | 0 | 1 => {
  if (left === right) {
    return 0;
  }

  if (typeof left !== typeof right) {
    return typeof left === 'number' ? -1 : 1;
  }

  return left < right ? -1 : 1;
};

// The order of the first pair of items that differ; a list that runs out first comes first.
const orderLists = (
  left: ReadonlyArray<string | number>,
  right: ReadonlyArray<string | number>,
): -1 | 0 | 1 => {
  for (const [index, item] of left.entries()) {
    const other = right[index];

    if (other === undefined) {
      return 1;
    }

    const result = order(item, other);

    if (result !== 0) {
      return result;
    }
  }

  return left.length < right.length ? -1 : 0;
};

/**
 * A version number as Semantic Versioning 2.0.0 (semver.org) writes it: `MAJOR.MINOR.PATCH`, with
 * an optional `-prerelease` and `+build` part.
 *
 * @remarks
 * A leading `v` is refused, as the specification says `v1.2.3` is not a semantic version. The text
 * is at most 256 characters, as in the `semver` package on npm, and every number in it, prerelease
 * numbers included, at most `Number.MAX_SAFE_INTEGER`, so no number loses digits. `compare()` orders versions by the
 * precedence of section 11, where build metadata doesn't count; `equals()` compares the text, so
 * `1.0.0+a` and `1.0.0+b` compare as 0 yet are not equal.
 *
 * @example
 * ```ts
 * const version = new SemVer('2.0.0-rc.1+build.5');
 * version.prerelease; // ['rc', 1]
 * version.isNewerThan(new SemVer('2.0.0-beta.9')); // true
 * ```
 */
export class SemVer extends SemVerBase {
  /**
   * The grammar of the specification with the length and number limits.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The first number, which changes when the public API breaks.
   */
  public get major(): number {
    return partsOf(this.value).core[0];
  }

  /**
   * The second number, which changes when features are added.
   */
  public get minor(): number {
    return partsOf(this.value).core[1];
  }

  /**
   * The third number, which changes when bugs are fixed.
   */
  public get patch(): number {
    return partsOf(this.value).core[2];
  }

  /**
   * The dot-separated identifiers after the `-`, numeric ones as numbers; empty for a release.
   */
  public get prerelease(): ReadonlyArray<string | number> {
    return partsOf(this.value).prerelease;
  }

  /**
   * The dot-separated identifiers after the `+`, as written; empty when there are none.
   */
  public get build(): readonly string[] {
    return partsOf(this.value).build;
  }

  /**
   * Whether the version carries a prerelease part, such as `1.0.0-alpha`.
   */
  public get isPrerelease(): boolean {
    return partsOf(this.value).prerelease.length > 0;
  }

  /**
   * -1 when this version comes before the other, 1 when after, 0 when both have the same
   * precedence; sorts an array with `versions.sort((a, b) => a.compare(b))`.
   */
  public compare(other: SemVer): -1 | 0 | 1 {
    const left = partsOf(this.value);
    const right = partsOf(other.value);

    const core = orderLists(left.core, right.core);

    if (core !== 0) {
      return core;
    }

    // A release comes after its prereleases, the one place where the shorter list comes last.
    if (left.prerelease.length === 0 || right.prerelease.length === 0) {
      return order(left.prerelease.length === 0 ? 1 : 0, right.prerelease.length === 0 ? 1 : 0);
    }

    return orderLists(left.prerelease, right.prerelease);
  }

  /**
   * Whether this version comes after the other by precedence.
   */
  public isNewerThan(other: SemVer): boolean {
    return this.compare(other) === 1;
  }
}
