import type { NominalSchema } from './contracts.ts';
import { NativeSchema } from './native-schema.ts';
import { PatternSchema } from './pattern-schema.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';

/**
 * Internal: one check of a flat plan, and the issues it reports when it fails: about the input as
 * given, which a rule from another library before the check may have converted into `value`.
 */
export interface Step {
  readonly accepts: (value: unknown) => boolean;
  readonly issues: (value: unknown, input: unknown) => readonly StandardSchemaV1.Issue[];
}

const stepOf = (rule: NativeSchema<unknown>): Step => ({
  accepts: rule.accepts,
  issues: (_value, input) => rule.issuesFor(input),
});

// Joined into one expression, a backreference would count the groups of the patterns before it,
// and a group name used twice would not compile. Anything that looks like either keeps the
// pattern apart; a false alarm only costs the folding.
const groupReference = /\\(?:[1-9]|k<)|\(\?<(?![=!])/u;

const mergeable = (rule: NominalSchema): rule is PatternSchema =>
  rule instanceof PatternSchema &&
  rule.pattern.source.startsWith('^') &&
  !rule.pattern.source.includes('|') &&
  !groupReference.test(rule.pattern.source);

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
    issues: (value, input) =>
      (patterns.find((schema) => !schema.accepts(value)) ?? first).issuesFor(input),
  };
};

/**
 * Internal: patterns and type guards as a flat list of checks.
 *
 * @remarks
 * Neighbouring patterns that start with `^`, hold no `|`, no backreference and no named group, and
 * share their flags are folded into one expression of lookaheads, which tests the string once; such
 * patterns match only from the start, so testing them together there is the same as testing them
 * apart.
 */
export const planOf = (rules: ReadonlyArray<NativeSchema<unknown>>): readonly Step[] => {
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
  let native: Array<NativeSchema<unknown>> = [];

  const flush = (): void => {
    steps.push(...planOf(native));
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
