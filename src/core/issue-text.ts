import type { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * Internal: an issue as one line, with its path in front: `ids.1: must be a UUID (was "x")`.
 *
 * @remarks
 * `name` is the parameter or property the value came from; an issue with no name and no path is
 * its message alone.
 */
export const issueText = (issue: StandardSchemaV1.Issue, name?: string): string => {
  const path = [name, ...(issue.path ?? [])]
    .filter((segment) => segment !== undefined)
    .map((segment) => String(typeof segment === 'object' ? segment.key : segment));

  return path.length === 0 ? issue.message : `${path.join('.')}: ${issue.message}`;
};
