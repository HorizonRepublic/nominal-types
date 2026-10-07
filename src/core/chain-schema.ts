import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import type { NominalSchema } from './contracts.ts';
import { PatternSchema, patternIssues } from './pattern-schema.ts';
import { PredicateSchema, predicateIssues } from './predicate-schema.ts';
import { Rejection } from './rejection.ts';
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
 * Internal. Patterns and chains are run directly, so an accepted value allocates nothing on the
 * way; any other schema goes through its Standard Schema `validate`, which has to answer
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
    const value = runSchema(schema.parent, input);
    return value instanceof Rejection ? value : runSchema(schema.constraint, value);
  }
  const result = schema['~standard'].validate(input);
  if (result instanceof Promise) {
    throw new TypeError('asynchronous schemas are not supported');
  }
  return result.issues === undefined ? result.value : new Rejection(result.issues.map(plainIssue));
};

const withoutUri = (schema: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$schema'));

const bothSides = (
  parent: StandardJSONSchemaV1.Converter | undefined,
  constraint: StandardJSONSchemaV1.Converter | undefined,
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
): Record<string, unknown> => {
  if (parent === undefined || constraint === undefined) {
    throw new TypeError('the schema cannot describe itself as JSON Schema');
  }
  const first = parent[side](options);
  const second = constraint[side](options);
  return {
    ...(first['$schema'] === undefined ? {} : { $schema: first['$schema'] }),
    allOf: [withoutUri(first), withoutUri(second)],
  };
};

/**
 * The schema of a subtype: the parent's schema, then a constraint on the value the parent accepted.
 *
 * @remarks
 * The constraint can only narrow what the parent accepts, never widen it. As JSON Schema the pair
 * becomes an `allOf` of both descriptions.
 */
export class ChainSchema {
  public readonly parent: NominalSchema;
  public readonly constraint: NominalSchema;
  public readonly '~standard': StandardProps<unknown, unknown>;

  public constructor(parent: NominalSchema, constraint: NominalSchema) {
    this.parent = parent;
    this.constraint = constraint;
    this['~standard'] = {
      version: 1,
      vendor: '@horizon-republic/nominal-types',
      validate: (value) => {
        const result = runSchema(this, value);
        return result instanceof Rejection ? { issues: result.issues } : { value: result };
      },
      jsonSchema: {
        input: (options) =>
          bothSides(
            parent['~standard'].jsonSchema,
            constraint['~standard'].jsonSchema,
            'input',
            options,
          ),
        output: (options) =>
          bothSides(
            parent['~standard'].jsonSchema,
            constraint['~standard'].jsonSchema,
            'output',
            options,
          ),
      },
    };
  }
}
