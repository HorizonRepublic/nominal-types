import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { NominalSchema } from './contracts.ts';
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
