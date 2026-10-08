import { PatternSchema } from '../../core/pattern-schema.ts';
import { labelFragment } from './dns-name.ts';

export const atom = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
export const label: string = labelFragment;
export const topLevel = '(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})';

const address = `${atom}(?:\\.${atom})*@(?:${label}\\.)+${topLevel}`;
const withoutLimits = `^${address}$`;
const addressOnly = new RegExp(withoutLimits, 'u');

export const pattern: RegExp = new RegExp(`^(?=.{6,254}$)(?=[^@]{1,64}@)${address}$`, 'u');

// Accepts exactly what `pattern` accepts. Checking the limits in code before a pattern without
// lookaheads halves the cost of a valid address and turns most invalid ones away before the pattern.
class EmailSchema extends PatternSchema {
  public override readonly accepts = (value: unknown): value is string => {
    if (typeof value !== 'string' || value.length < 6 || value.length > 254) {
      return false;
    }

    const at = value.indexOf('@');

    return at >= 1 && at <= 64 && addressOnly.test(value);
  };
}

/**
 * Internal: the rule of `Email`.
 */
// JSON Schema tools built on RE2 have no lookaheads, so the schema states the limits of the
// pattern as lengths, and refuses more than 64 characters before the @ with `not`.
export const emailRule: PatternSchema = new EmailSchema(pattern, 'an email address', {
  pattern: withoutLimits,
  format: 'email',
  minLength: 6,
  maxLength: 254,
  not: { pattern: '^[^@]{65}' },
  examples: ['jane.doe@example.com'],
});
