import { issueOf } from './messages.ts';
import { defaultMaxIssues, settings } from './settings.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';

/**
 * The most issues one check reports, as `n.configure()` set it.
 *
 * @internal
 */
export const maxIssues = (): number => settings.maxIssues ?? defaultMaxIssues;

/**
 * The issues a schema of several parts collected, cut to the most one check reports, with one
 * issue saying the check stopped; the issues themselves when there are no more than that.
 *
 * @remarks
 * Cutting again changes nothing, so a nested schema that stopped and the schema around it agree.
 * A type reports one issue and never needs the cut, so this stays out of a bundle of types alone.
 *
 * @internal
 */
export const cappedIssues = (
  issues: readonly StandardSchemaV1.Issue[],
): readonly StandardSchemaV1.Issue[] => {
  const max = maxIssues();

  if (issues.length <= max) {
    return issues;
  }

  return [
    ...issues.slice(0, max),
    issueOf('too_many_issues', `stopped after ${String(max)} issues`, { wording: { max } }),
  ];
};
