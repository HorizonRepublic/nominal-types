import { satisfying } from '../../core/predicate-schema.ts';
import type { PredicateSchema } from '../../core/predicate-schema.ts';

/**
 * Internal: the rule of a UUID version type, which runs after the rule of `Uuid` and so only
 * reads the version digit; the nil and max UUIDs fail it, since their digit is `0` or `f`.
 */
export const uuidVersion = (digit: string, examples: readonly string[]): PredicateSchema<string> =>
  satisfying(
    (value: unknown): value is string => typeof value === 'string' && value.charAt(14) === digit,
    `a version ${digit} UUID`,
    { type: 'string', pattern: `^.{14}${digit}`, examples },
  );
