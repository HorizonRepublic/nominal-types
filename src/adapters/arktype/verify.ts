import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { AnyConstraint } from '../../core/constraint-types.ts';
import type { JsonNode } from './json-node.ts';
import { metaOf } from './json-node.ts';
import { constraintsKey, registry } from './registry.ts';

/**
 * Internal: runs the constraints at and below a place of the built value, adding issues with
 * their full paths.
 */
export type Verify = (
  value: unknown,
  path: PropertyKey[],
  issues: StandardSchemaV1.Issue[],
) => void;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

/**
 * Internal: runs each verifier on a key of the value, with the key added to the path.
 */
export const verifyKeys =
  (verifiers: ReadonlyArray<readonly [PropertyKey, Verify]>): Verify =>
  (value, path, issues) => {
    if (!isRecord(value)) {
      return;
    }

    for (const [key, verify] of verifiers) {
      path.push(key);
      verify(Reflect.get(value, key), path, issues);
      path.pop();
    }
  };

const withPath = (
  path: readonly PropertyKey[],
  issue: StandardSchemaV1.Issue,
): StandardSchemaV1.Issue => {
  const full = [...path, ...(issue.path ?? [])];

  return full.length === 0 ? { message: issue.message } : { message: issue.message, path: full };
};

/**
 * Internal: the constraints `withConstraints()` attached to an object node.
 *
 * @throws TypeError for an id no constraint was registered under.
 */
export const constraintsOf = (node: JsonNode): readonly AnyConstraint[] => {
  const ids = metaOf(node, constraintsKey);

  return (typeof ids === 'string' ? ids.split(',') : []).map((id) => {
    const found = registry.constraints.get(id);

    if (found === undefined) {
      throw new TypeError(`arkSchema: constraint ${id} is unknown`);
    }

    return found;
  });
};

/**
 * Internal: runs constraints on one object.
 */
export const verifyConstraints =
  (constraints: readonly AnyConstraint[]): Verify =>
  (value, path, issues) => {
    if (!isRecord(value)) {
      return;
    }

    for (const constraint of constraints) {
      issues.push(...constraint.issuesOf(value).map((issue) => withPath(path, issue)));
    }
  };

/**
 * Internal: one verifier that runs both, where both exist.
 */
export const combine = (
  first: Verify | undefined,
  second: Verify | undefined,
): Verify | undefined => {
  if (first === undefined || second === undefined) {
    return first ?? second;
  }

  return (value, path, issues) => {
    first(value, path, issues);
    second(value, path, issues);
  };
};
