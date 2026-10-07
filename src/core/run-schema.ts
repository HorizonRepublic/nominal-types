import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { NominalSchema } from './contracts.ts';
import { NativeSchema } from './native-schema.ts';
import { Rejection } from './rejection.ts';
import { runners } from './runner.ts';

const plainIssue = (issue: StandardSchemaV1.Issue): StandardSchemaV1.Issue =>
  issue.path === undefined || issue.path.length === 0
    ? { message: issue.message }
    : {
        message: issue.message,
        path: issue.path.map((segment) => (typeof segment === 'object' ? segment.key : segment)),
      };

/**
 * Internal: runs a schema and returns the accepted value itself, or a `Rejection` carrying plain
 * issues.
 *
 * @remarks
 * Patterns, guards, chains and `schemaOf()` schemas run directly, so an accepted value allocates
 * nothing on the way; any other schema goes through its Standard Schema `validate`, which has to
 * answer synchronously.
 *
 * @throws TypeError when a schema answers with a Promise.
 */
export const runSchema = (schema: NominalSchema, input: unknown): unknown => {
  if (schema instanceof NativeSchema) {
    return schema.accepts(input) ? input : new Rejection(schema.issuesFor(input));
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

/**
 * Internal: how a rule from another library runs inside a type, chosen once: the runner of a
 * `schemaOf()` schema, or the rule's `validate`.
 *
 * @throws TypeError naming the type when the rule answers with a Promise.
 */
export const foreignRunner = (
  rule: NominalSchema,
  typeName: string,
): ((value: unknown) => unknown) => {
  const runner = runners.get(rule);
  if (runner !== undefined) {
    return runner;
  }
  const { validate } = rule['~standard'];
  return (value) => {
    const result = validate(value);
    if (result instanceof Promise) {
      throw new TypeError(`${typeName}: asynchronous schemas are not supported`);
    }
    return result.issues === undefined
      ? result.value
      : new Rejection(result.issues.map(plainIssue));
  };
};
