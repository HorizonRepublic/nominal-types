import type { AnyConstraint } from '../../core/constraint-types.ts';
import type { StandardSchemaV1 } from '../../core/standard-spec.ts';
import type { JsonNode } from './json-node.ts';
import { metaOf } from './json-node.ts';
import { constraintsKey, registry } from './registry.ts';

/**
 * Runs the constraints at and below a place of the built value, adding issues with
 * their full paths.
 *
 * @internal
 */
export type Verify = (
  value: unknown,
  path: PropertyKey[],
  issues: StandardSchemaV1.Issue[],
) => void;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

/**
 * Runs each verifier on a key of the value, with the key added to the path.
 *
 * @internal
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
 * The constraints `constrainArk()` attached to an object node.
 *
 * @throws {@link TypeError} when no constraint was registered under an id.
 *
 * @internal
 */
export const constraintsOf = (node: JsonNode): readonly AnyConstraint[] => {
  const ids = metaOf(node, constraintsKey);

  return (typeof ids === 'string' ? ids.split(',') : []).map((id) => {
    const found = registry.constraints.get(id);

    if (found === undefined) {
      throw new TypeError(`fromArk: constraint ${id} is unknown`);
    }

    return found;
  });
};

/**
 * Runs constraints on one object.
 *
 * @internal
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
 * One verifier that runs both, where both exist.
 *
 * @internal
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
