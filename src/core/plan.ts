import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { NominalSchema } from './contracts.ts';
import { NativeSchema } from './native-schema.ts';
import { PatternSchema } from './pattern-schema.ts';
import { Rejection } from './rejection.ts';

/**
 * Internal: one check of a flat plan, and the issues it reports when it fails.
 */
export interface Step {
  readonly accepts: (value: unknown) => boolean;
  readonly issues: (value: unknown) => readonly StandardSchemaV1.Issue[];
}

const stepOf = (rule: NativeSchema<unknown>): Step => ({
  accepts: rule.accepts,
  issues: (value) => rule.issuesFor(value),
});

const mergeable = (rule: NominalSchema): rule is PatternSchema =>
  rule instanceof PatternSchema &&
  rule.pattern.source.startsWith('^') &&
  !rule.pattern.source.includes('|');

const mergedStep = (first: PatternSchema, rest: readonly PatternSchema[]): Step => {
  if (rest.length === 0) {
    return stepOf(first);
  }
  const patterns = [first, ...rest];
  const combined = new RegExp(
    `^${patterns.map((schema) => `(?=${schema.pattern.source})`).join('')}`,
    first.pattern.flags,
  );
  return {
    accepts: (value) => typeof value === 'string' && combined.test(value),
    issues: (value) =>
      (patterns.find((schema) => !schema.accepts(value)) ?? first).issuesFor(value),
  };
};

const allNative = (
  rules: readonly NominalSchema[],
): rules is ReadonlyArray<NativeSchema<unknown>> =>
  rules.every((rule) => rule instanceof NativeSchema);

/**
 * Internal: the rules of a chain as a flat list of checks, or `undefined` when a rule comes from
 * another library and has to run through `validate`.
 *
 * @remarks
 * Neighbouring patterns that start with `^`, hold no `|` and share their flags are folded into one
 * expression of lookaheads, which tests the string once; such patterns match only from the start,
 * so testing them together there is the same as testing them apart.
 */
export const planOf = (rules: readonly NominalSchema[]): readonly Step[] | undefined => {
  if (!allNative(rules)) {
    return undefined;
  }
  const steps: Step[] = [];
  let group: PatternSchema[] = [];
  const flush = (): void => {
    const [first, ...rest] = group;
    if (first !== undefined) {
      steps.push(mergedStep(first, rest));
    }
    group = [];
  };
  for (const rule of rules) {
    if (!mergeable(rule)) {
      flush();
      steps.push(stepOf(rule));
    } else if (group[0] !== undefined && group[0].pattern.flags !== rule.pattern.flags) {
      flush();
      group.push(rule);
    } else {
      group.push(rule);
    }
  }
  flush();
  return steps;
};

/**
 * Internal: runs a flat plan, returning the value or the `Rejection` of the first failing step.
 */
export const runPlan = (plan: readonly Step[], input: unknown): unknown => {
  for (const step of plan) {
    if (!step.accepts(input)) {
      return new Rejection(step.issues(input));
    }
  }
  return input;
};

/**
 * Internal: a rule from another library inside a type's rules, which may change the value; it
 * returns the value the next rule sees, or a `Rejection`.
 */
export interface ConvertStep {
  readonly convert: (value: unknown) => unknown;
}

/**
 * Internal: the rules of a type as steps: checks for patterns and guards, folded as `planOf` folds
 * them, and a mapping step for each rule from another library.
 */
export const stepsOf = (
  rules: readonly NominalSchema[],
  convertOf: (rule: NominalSchema) => ConvertStep,
): ReadonlyArray<Step | ConvertStep> => {
  const steps: Array<Step | ConvertStep> = [];
  let native: NominalSchema[] = [];
  const flush = (): void => {
    steps.push(...(planOf(native) ?? []));
    native = [];
  };
  for (const rule of rules) {
    if (rule instanceof NativeSchema) {
      native.push(rule);
    } else {
      flush();
      steps.push(convertOf(rule));
    }
  }
  flush();
  return steps;
};
