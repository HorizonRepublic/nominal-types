import { satisfying } from '../../core/predicate-schema.ts';
import type { PredicateSchema } from '../../core/predicate-schema.ts';

/**
 * Internal: a rule for numbers that pass `test`.
 */
export const numberRule = (
  description: string,
  test: (value: number) => boolean,
  json: Readonly<Record<string, unknown>>,
): PredicateSchema<number> =>
  satisfying(
    (value: unknown): value is number => typeof value === 'number' && test(value),
    description,
    json,
  );

/**
 * Internal: a rule for whole numbers from `lowest` to `highest`, with the same bounds in its JSON
 * Schema.
 */
export const integerBetween = (
  lowest: number,
  highest: number,
  description: string,
  json: Readonly<Record<string, unknown>> = {},
): PredicateSchema<number> =>
  numberRule(description, (value) => value >= lowest && value <= highest, {
    type: 'integer',
    minimum: lowest,
    maximum: highest,
    ...json,
  });
