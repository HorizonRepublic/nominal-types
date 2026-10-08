import type { NominalSchema } from './contracts.ts';
import { settleParts } from './deferred-parts.ts';
import { valuesAsConfigured } from './hidden-values.ts';
import type { NominalIssue } from './issue-codes.ts';
import { Rejection } from './rejection.ts';
import { runners } from './runner.ts';
import { isOwnVendor } from './standard-props.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';

const plainIssue = (issue: StandardSchemaV1.Issue): StandardSchemaV1.Issue =>
  issue.path === undefined || issue.path.length === 0
    ? { message: issue.message }
    : {
        message: issue.message,
        path: issue.path.map((segment) => (typeof segment === 'object' ? segment.key : segment)),
      };

// An issue from another copy of this package keeps its code.
const ownIssue = (issue: NominalIssue): NominalIssue => {
  const plain = plainIssue(issue);

  return issue.code === undefined ? plain : { code: issue.code, ...plain };
};

/**
 * Internal: how a rule from another library runs inside a type, chosen once: the runner of a
 * `n.of()` schema, or the rule's `validate`, whose messages then follow the `values` setting.
 *
 * @throws TypeError naming the type when the rule answers with a Promise.
 */
export const foreignRunner = (
  rule: NominalSchema,
  typeName: string,
): ((value: unknown) => unknown) => {
  settleParts(rule);

  const runner = runners.get(rule);

  if (runner !== undefined) {
    return runner;
  }

  const { validate } = rule['~standard'];
  const copy = isOwnVendor(rule) ? ownIssue : plainIssue;

  return (value) => {
    const result = validate(value);

    if (result instanceof Promise) {
      throw new TypeError(`${typeName}: asynchronous schemas are not supported`);
    }

    return result.issues === undefined
      ? result.value
      : new Rejection(valuesAsConfigured(result.issues.map(copy)));
  };
};
