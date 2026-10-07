import { satisfying } from '../core/predicate-schema.ts';
import type { PredicateSchema } from '../core/predicate-schema.ts';

const isText = (value: unknown): value is string => typeof value === 'string';

/**
 * Internal: the rule a built-in string type starts from, before its own pattern.
 */
export const textRule: PredicateSchema<string> = satisfying(isText, 'a string', { type: 'string' });
