import type { StandardJSONSchemaV1 } from '@standard-schema/spec';

import type { NominalSchema } from './contracts.ts';
import { withoutUri } from './json-target.ts';
import { planOf, runPlan } from './plan.ts';
import type { Step } from './plan.ts';
import { Rejection } from './rejection.ts';
import { runSchema } from './run-schema.ts';
import { runners } from './runner.ts';
import { standardProps } from './standard-props.ts';
import type { StandardProps } from './standard-schema.ts';

const runRules = (rules: readonly NominalSchema[], input: unknown): unknown => {
  let value = input;

  for (const rule of rules) {
    value = runSchema(rule, value);

    if (value instanceof Rejection) {
      return value;
    }
  }

  return value;
};

const describeAll = (
  rules: readonly NominalSchema[],
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
): Record<string, unknown> => {
  const parts = rules.map((rule) => {
    const converter = rule['~standard'].jsonSchema;

    if (converter === undefined) {
      throw new TypeError('the schema cannot describe itself as JSON Schema');
    }

    return converter[side](options);
  });
  const uri = parts.find((part) => part['$schema'] !== undefined)?.['$schema'];

  return {
    ...(uri === undefined ? {} : { $schema: uri }),
    allOf: parts.map((part) => withoutUri(part)),
  };
};

/**
 * The rules of every level of a type, run in order from the root down.
 *
 * @remarks
 * Internal. Each rule sees the value the previous one produced and runs only if the previous one
 * accepted, so a level can only narrow what the levels above it accept. When every rule is a
 * pattern or a type guard, the chain runs them as a flat plan. As JSON Schema the rules become an
 * `allOf`.
 */
export class ChainSchema {
  public readonly rules: readonly NominalSchema[];
  public readonly plan: readonly Step[] | undefined;
  public readonly '~standard': StandardProps<unknown, unknown>;

  public constructor(rules: readonly NominalSchema[]) {
    const plan = planOf(rules);
    const run = (input: unknown): unknown =>
      plan === undefined ? runRules(rules, input) : runPlan(plan, input);

    this.rules = rules;
    this.plan = plan;
    this['~standard'] = standardProps(run, (side, options) => describeAll(rules, side, options));
    runners.set(this, run);
  }
}
