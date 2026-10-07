import type { StandardJSONSchemaV1 } from '@standard-schema/spec';

import { compileRun } from './compile.ts';
import type { NominalSchema } from './contracts.ts';
import { withValidExamples } from './examples.ts';
import { foreignRunner } from './foreign-runner.ts';
import { frozen } from './frozen.ts';
import { rulesOf } from './hierarchy.ts';
import { stepsOf } from './plan.ts';
import { Rejection } from './rejection.ts';
import { describeRules } from './rules-json.ts';
import { withoutImpliedString } from './string-rule.ts';

/**
 * Internal: what the functions below need of a nominal type class.
 */
export interface TypeClass {
  readonly typeName: string;
}

const typeRules = new WeakMap<object, readonly NominalSchema[]>();

const rulesFor = (root: object, target: TypeClass): readonly NominalSchema[] => {
  const cached = typeRules.get(target);

  if (cached !== undefined) {
    return cached;
  }

  const rules = withoutImpliedString(rulesOf(root, target));

  typeRules.set(target, rules);

  return rules;
};

const typeRunners = new WeakMap<object, (input: unknown) => unknown>();

const runnerOf = (root: object, target: TypeClass): ((input: unknown) => unknown) =>
  compileRun(
    stepsOf(rulesFor(root, target), (rule) => ({
      convert: foreignRunner(rule, target.typeName),
    })),
  );

/**
 * Internal: runs every rule of a type on a value, returning the value or a `Rejection`.
 *
 * @remarks
 * Each type runs one function generated for its rules, rules from other libraries included. An
 * object value comes back frozen all the way down.
 *
 * @throws TypeError naming the type when a rule fails to run, such as an asynchronous schema.
 */
export const runType = (root: object, target: TypeClass, input: unknown): unknown => {
  let runner = typeRunners.get(target);

  if (runner === undefined) {
    runner = runnerOf(root, target);
    typeRunners.set(target, runner);
  }

  const value = runner(input);

  return typeof value === 'object' && value !== null ? frozen(value) : value;
};

/**
 * Internal: a type's JSON Schema, with its name as `title` and only the examples it accepts.
 *
 * @throws TypeError naming the type when a rule can't describe itself.
 */
export const describeType = (
  root: object,
  target: TypeClass,
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
): Record<string, unknown> => {
  const { $schema, title, ...body } = describeRules(
    target.typeName,
    rulesFor(root, target),
    side,
    options,
  );
  const accepts = (example: unknown): boolean =>
    !(runType(root, target, example) instanceof Rejection);

  return {
    ...($schema === undefined ? {} : { $schema }),
    title: title ?? target.typeName,
    ...withValidExamples(body, options, accepts),
  };
};
