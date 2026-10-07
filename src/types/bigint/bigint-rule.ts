import { satisfying } from '../../core/predicate-schema.ts';
import type { PredicateSchema } from '../../core/predicate-schema.ts';

/**
 * Internal: a rule for bigints that pass `test`.
 */
export const bigintRule = (
  description: string,
  test: (value: bigint) => boolean,
  json: Readonly<Record<string, unknown>>,
): PredicateSchema<bigint> =>
  satisfying(
    (value: unknown): value is bigint => typeof value === 'bigint' && test(value),
    description,
    json,
  );
