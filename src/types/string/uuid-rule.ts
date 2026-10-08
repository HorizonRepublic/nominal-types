// A UUID is ASCII only, and a code unit is cheaper to read than a code point; anything outside
// ASCII misses the table and fails.
// oxlint-disable unicorn/prefer-code-point
import { PatternSchema } from '../../core/pattern-schema.ts';

export const pattern: RegExp =
  /^(?:[\dA-Fa-f]{8}-[\dA-Fa-f]{4}-[1-8][\dA-Fa-f]{3}-[89ABab][\dA-Fa-f]{3}-[\dA-Fa-f]{12}|0{8}-0{4}-0{4}-0{4}-0{12}|[Ff]{8}-[Ff]{4}-[Ff]{4}-[Ff]{4}-[Ff]{12})$/u;

const hexDigit = 1;
const versionDigit = 2;
const variantDigit = 4;
const hyphen = 45;
const nil = '00000000-0000-0000-0000-000000000000';
const max = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const kindsOf = (): Uint8Array => {
  const kinds = new Uint8Array(128);

  for (const digit of '0123456789abcdefABCDEF') {
    kinds[digit.charCodeAt(0)] =
      hexDigit |
      ('12345678'.includes(digit) ? versionDigit : 0) |
      ('89abAB'.includes(digit) ? variantDigit : 0);
  }

  return kinds;
};

const kinds = kindsOf();

const kindsAt = (text: string, at: number): number =>
  (kinds[text.charCodeAt(at)] ?? 0) &
  (kinds[text.charCodeAt(at + 1)] ?? 0) &
  (kinds[text.charCodeAt(at + 2)] ?? 0) &
  (kinds[text.charCodeAt(at + 3)] ?? 0);

// Accepts exactly what `pattern` accepts. Reading the 32 digits through a table costs about half
// of what the pattern does.
class UuidSchema extends PatternSchema {
  public override readonly accepts = (value: unknown): value is string => {
    if (
      typeof value !== 'string' ||
      value.length !== 36 ||
      value.charCodeAt(8) !== hyphen ||
      value.charCodeAt(13) !== hyphen ||
      value.charCodeAt(18) !== hyphen ||
      value.charCodeAt(23) !== hyphen
    ) {
      return false;
    }

    const digits =
      kindsAt(value, 0) &
      kindsAt(value, 4) &
      kindsAt(value, 9) &
      kindsAt(value, 14) &
      kindsAt(value, 19) &
      kindsAt(value, 24) &
      kindsAt(value, 28) &
      kindsAt(value, 32);

    if ((digits & hexDigit) === 0) {
      return false;
    }

    return (
      (((kinds[value.charCodeAt(14)] ?? 0) & versionDigit) !== 0 &&
        ((kinds[value.charCodeAt(19)] ?? 0) & variantDigit) !== 0) ||
      value === nil ||
      value.toLowerCase() === max
    );
  };
}

/**
 * Internal: the rule of `Uuid`.
 */
export const uuidRule: PatternSchema = new UuidSchema(pattern, 'a UUID', {
  format: 'uuid',
  minLength: 36,
  maxLength: 36,
  examples: ['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'],
});
