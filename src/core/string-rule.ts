import type { NominalSchema } from './contracts.ts';
import type { IssueCode } from './issue-codes.ts';
import { PatternSchema } from './pattern-schema.ts';
import { PredicateSchema } from './predicate-schema.ts';

const isString = (value: unknown): value is string => typeof value === 'string';

class StringRule extends PredicateSchema<string> {
  public override codeFor(): IssueCode {
    return 'not_a_string';
  }
}

/**
 * The rule of `AnyString`.
 *
 * @internal
 */
export const stringRule: PredicateSchema<string> = new StringRule(isString, 'a string', {
  type: 'string',
});

const stringOnlyRules = new WeakSet<NominalSchema>();

/**
 * Marks a built-in rule that rejects anything but a string by itself, so the string
 * check of `AnyString` can be left out in front of it.
 *
 * @internal
 */
export const stringOnly = <Schema extends NominalSchema>(schema: Schema): Schema => {
  stringOnlyRules.add(schema);

  return schema;
};

const checksString = (rule: NominalSchema | undefined): boolean =>
  rule instanceof PatternSchema || (rule !== undefined && stringOnlyRules.has(rule));

/**
 * The rules without the string check of `AnyString` where the next rule makes it
 * redundant, which leaves a type such as `Email` with a single rule to run.
 *
 * @internal
 */
export const withoutImpliedString = (rules: readonly NominalSchema[]): readonly NominalSchema[] =>
  rules.some((rule, index) => rule === stringRule && checksString(rules[index + 1]))
    ? rules.filter((rule, index) => rule !== stringRule || !checksString(rules[index + 1]))
    : rules;
