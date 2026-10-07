import type { StandardJSONSchemaV1 } from '@standard-schema/spec';

import { ChainSchema } from './chain-schema.ts';
import { compileRun } from './compile.ts';
import type { NominalSchema } from './contracts.ts';
import { withValidExamples } from './examples.ts';
import { rulesOf } from './hierarchy.ts';
import { stepsOf } from './plan.ts';
import { Rejection } from './rejection.ts';
import { foreignRunner } from './run-schema.ts';
import { withoutImpliedString } from './string-rule.ts';

/**
 * Internal: what the functions below need of a nominal type class.
 */
export interface TypeClass {
  readonly typeName: string;
}

const effectiveSchemas = new WeakMap<object, NominalSchema>();

const effectiveSchemaOf = (root: object, target: TypeClass): NominalSchema => {
  const cached = effectiveSchemas.get(target);
  if (cached !== undefined) {
    return cached;
  }
  const rules = withoutImpliedString(rulesOf(root, target));
  const [only] = rules;
  const schema = rules.length === 1 && only !== undefined ? only : new ChainSchema(rules);
  effectiveSchemas.set(target, schema);
  return schema;
};

const typeRunners = new WeakMap<object, (input: unknown) => unknown>();

const runnerOf = (root: object, target: TypeClass): ((input: unknown) => unknown) =>
  compileRun(
    stepsOf(withoutImpliedString(rulesOf(root, target)), (rule) => ({
      convert: foreignRunner(rule, target.typeName),
    })),
  );

/**
 * Internal: runs every rule of a type on a value, returning the value or a `Rejection`.
 *
 * @remarks
 * Each type runs one function generated for its rules, rules from other libraries included.
 *
 * @throws TypeError naming the type when a rule fails to run, such as an asynchronous schema.
 */
export const runType = (root: object, target: TypeClass, input: unknown): unknown => {
  let runner = typeRunners.get(target);
  if (runner === undefined) {
    runner = runnerOf(root, target);
    typeRunners.set(target, runner);
  }
  return runner(input);
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
  const converter = effectiveSchemaOf(root, target)['~standard'].jsonSchema;
  if (converter === undefined) {
    throw new TypeError(`${target.typeName}: the schema cannot describe itself as JSON Schema`);
  }
  const { $schema, title, ...body } = converter[side](options);
  const accepts = (example: unknown): boolean =>
    !(runType(root, target, example) instanceof Rejection);
  return {
    ...($schema === undefined ? {} : { $schema }),
    title: title ?? target.typeName,
    ...withValidExamples(body, options, accepts),
  };
};
