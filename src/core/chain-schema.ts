import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import type { NominalSchema } from './contracts.ts';
import { PatternSchema, patternIssues } from './pattern-schema.ts';
import { PredicateSchema, predicateIssues } from './predicate-schema.ts';
import { Rejection } from './rejection.ts';
import { runners } from './runner.ts';
import { withoutUri } from './schema-text.ts';
import type { StandardProps } from './standard-schema.ts';

const plainIssue = (issue: StandardSchemaV1.Issue): StandardSchemaV1.Issue =>
  issue.path === undefined || issue.path.length === 0
    ? { message: issue.message }
    : {
        message: issue.message,
        path: issue.path.map((segment) => (typeof segment === 'object' ? segment.key : segment)),
      };

/**
 * Runs a schema and returns the accepted value itself, or a `Rejection` carrying plain issues.
 *
 * @remarks
 * Internal. Patterns, chains and schemas built by `schemaOf()` are run directly, so an accepted
 * value allocates nothing on the way; any other schema goes through its Standard Schema `validate`, which has to answer
 * synchronously.
 *
 * @throws TypeError when a schema answers with a Promise.
 */
export const runSchema = (schema: NominalSchema, input: unknown): unknown => {
  if (schema instanceof PatternSchema) {
    return schema.accepts(input) ? input : new Rejection(patternIssues(schema, input));
  }
  if (schema instanceof PredicateSchema) {
    return schema.check(input) ? input : new Rejection(predicateIssues(schema, input));
  }
  if (schema instanceof ChainSchema) {
    const plan = schema.plan;
    if (plan !== undefined) {
      for (const step of plan) {
        if (!step.accepts(input)) {
          return new Rejection(step.issues(input));
        }
      }
      return input;
    }
    let value = input;
    for (const rule of schema.rules) {
      value = runSchema(rule, value);
      if (value instanceof Rejection) {
        return value;
      }
    }
    return value;
  }
  const runner = runners.get(schema);
  if (runner !== undefined) {
    return runner(input);
  }
  const result = schema['~standard'].validate(input);
  if (result instanceof Promise) {
    throw new TypeError('asynchronous schemas are not supported');
  }
  return result.issues === undefined ? result.value : new Rejection(result.issues.map(plainIssue));
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

interface Step {
  readonly accepts: (value: unknown) => boolean;
  readonly issues: (value: unknown) => readonly StandardSchemaV1.Issue[];
}

const stepOf = (rule: NominalSchema): Step | undefined => {
  if (rule instanceof PatternSchema) {
    return {
      accepts: (value) => rule.accepts(value),
      issues: (value) => patternIssues(rule, value),
    };
  }
  if (rule instanceof PredicateSchema) {
    return {
      accepts: rule.check,
      issues: (value) => predicateIssues(rule, value),
    };
  }
  return undefined;
};

const mergeable = (rule: NominalSchema): rule is PatternSchema =>
  rule instanceof PatternSchema &&
  rule.pattern.source.startsWith('^') &&
  !rule.pattern.source.includes('|');

const mergedStep = (patterns: readonly PatternSchema[]): Step => {
  const [first] = patterns;
  if (patterns.length === 1 && first !== undefined) {
    return {
      accepts: (value) => first.accepts(value),
      issues: (value) => patternIssues(first, value),
    };
  }
  const combined = new RegExp(
    `^${patterns.map((schema) => `(?=${schema.pattern.source})`).join('')}`,
    first?.pattern.flags,
  );
  return {
    accepts: (value) => typeof value === 'string' && combined.test(value),
    issues: (value) => {
      const failing = patterns.find((schema) => !schema.accepts(value)) ?? first;
      return failing === undefined ? [] : patternIssues(failing, value);
    },
  };
};

const planOf = (rules: readonly NominalSchema[]): readonly Step[] | undefined => {
  const steps: Step[] = [];
  let run: PatternSchema[] = [];
  const flush = (): void => {
    if (run.length > 0) {
      steps.push(mergedStep(run));
      run = [];
    }
  };
  for (const rule of rules) {
    if (mergeable(rule) && (run[0] === undefined || run[0].pattern.flags === rule.pattern.flags)) {
      run.push(rule);
      continue;
    }
    flush();
    if (mergeable(rule)) {
      run.push(rule);
      continue;
    }
    const step = stepOf(rule);
    if (step === undefined) {
      return undefined;
    }
    steps.push(step);
  }
  flush();
  return steps;
};

/**
 * The rules of every level of a type, run in order from the root down.
 *
 * @remarks
 * Internal. Each rule sees the value the previous one produced and runs only if the previous one
 * accepted, so a level can only narrow what the levels above it accept. When every rule is a
 * pattern or a type guard, none of which change the value, the chain runs them as a flat list of
 * checks, and folds neighbouring patterns that start with `^` and hold no `|` into one expression of
 * lookaheads, which tests the string once; such patterns match only from the start, so testing them
 * together at the start is the same as testing them apart. As JSON Schema the rules become an
 * `allOf`.
 */
export class ChainSchema {
  public readonly rules: readonly NominalSchema[];
  public readonly plan: readonly Step[] | undefined;
  public readonly '~standard': StandardProps<unknown, unknown>;

  public constructor(rules: readonly NominalSchema[]) {
    this.rules = rules;
    this.plan = planOf(rules);
    this['~standard'] = {
      version: 1,
      vendor: '@horizon-republic/nominal-types',
      validate: (value) => {
        const result = runSchema(this, value);
        return result instanceof Rejection ? { issues: result.issues } : { value: result };
      },
      jsonSchema: {
        input: (options) => describeAll(rules, 'input', options),
        output: (options) => describeAll(rules, 'output', options),
      },
    };
  }
}
