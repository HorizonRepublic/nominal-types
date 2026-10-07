import type { NominalSchema } from './contracts.ts';
import { PatternSchema } from './pattern-schema.ts';
import { satisfying } from './predicate-schema.ts';
import type { PredicateSchema } from './predicate-schema.ts';

const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * Internal: the rule of `AnyString`.
 */
export const stringRule: PredicateSchema<string> = satisfying(isString, 'a string', {
  type: 'string',
});

const stringOnlyRules = new WeakSet<NominalSchema>();

/**
 * Internal: marks a built-in rule that rejects anything but a string by itself, so the string
 * check of `AnyString` can be left out in front of it.
 */
export const stringOnly = <Schema extends NominalSchema>(schema: Schema): Schema => {
  stringOnlyRules.add(schema);

  return schema;
};

const checksString = (rule: NominalSchema | undefined): boolean =>
  rule instanceof PatternSchema || (rule !== undefined && stringOnlyRules.has(rule));

/**
 * Internal: the rules without the string check of `AnyString` where the next rule makes it
 * redundant, which leaves a type such as `Email` with a single rule to run.
 */
export const withoutImpliedString = (rules: readonly NominalSchema[]): readonly NominalSchema[] =>
  rules.some((rule, index) => rule === stringRule && checksString(rules[index + 1]))
    ? rules.filter((rule, index) => rule !== stringRule || !checksString(rules[index + 1]))
    : rules;
