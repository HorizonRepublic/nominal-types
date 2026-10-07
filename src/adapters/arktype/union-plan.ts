import { Rejection } from '../../core/rejection.ts';
import { checkerFor } from '../../core/type-functions.ts';
import type { JsonNode } from './json-node.ts';
import {
  isArrayNode,
  isJsonNode,
  isObjectNode,
  listOf,
  nominalNameOf,
  unsupported,
} from './json-node.ts';
import type { Plan, PlanOf } from './plan-contract.ts';
import { registry } from './registry.ts';

type Matcher = (value: unknown) => boolean;

const unitsOf = (node: JsonNode): ReadonlyArray<readonly [string, unknown]> =>
  listOf(node['required']).flatMap((entry) =>
    isJsonNode(entry) && isJsonNode(entry['value']) && Object.hasOwn(entry['value'], 'unit')
      ? [[String(entry['key']), entry['value']['unit']] as const]
      : [],
  );

const nominalMatcher = (name: string): Matcher | undefined => {
  const target = registry.types.get(name);

  if (target === undefined) {
    return undefined;
  }

  const check = checkerFor(target);

  return (value) => !(check(value) instanceof Rejection);
};

const objectMatcher = (node: JsonNode, branches: readonly unknown[]): Matcher => {
  const units = unitsOf(node);

  if (units.length > 0) {
    return (value) =>
      typeof value === 'object' &&
      value !== null &&
      units.every(([key, unit]) => Reflect.get(value, key) === unit);
  }

  if (branches.filter((branch) => isObjectNode(branch)).length > 1) {
    throw unsupported('a union of objects without a literal field');
  }

  return (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
};

const matcherOf = (node: unknown, branches: readonly unknown[]): Matcher => {
  const name =
    nominalNameOf(node) ??
    (isJsonNode(node) ? nominalNameOf(listOf(node['morphs']).at(-1)) : undefined);
  const nominal = name === undefined ? undefined : nominalMatcher(name);

  if (nominal !== undefined) {
    return nominal;
  }

  if (isArrayNode(node)) {
    if (branches.filter((branch) => isArrayNode(branch)).length > 1) {
      throw unsupported('a union of arrays');
    }

    return (value) => Array.isArray(value);
  }

  if (isObjectNode(node)) {
    return objectMatcher(node, branches);
  }

  throw unsupported('a union');
};

/**
 * Internal: the plan for a union: the first branch whose plan matches the value builds it.
 *
 * @throws TypeError when branches holding `arkOf()` nodes can't be told apart.
 */
export const unionPlan = (branches: readonly unknown[], planOf: PlanOf): Plan | undefined => {
  const planned = branches.flatMap((branch) => {
    const plan = planOf(branch);

    return plan === undefined ? [] : [{ plan, matches: matcherOf(branch, branches) }];
  });

  if (planned.length === 0) {
    return undefined;
  }

  const branchOf = (value: unknown): Plan | undefined =>
    planned.find(({ matches }) => matches(value))?.plan;

  return {
    build: (value) => branchOf(value)?.build(value) ?? value,
    verify: planned.every(({ plan }) => plan.verify === undefined)
      ? undefined
      : (value, path, issues) => {
          branchOf(value)?.verify?.(value, path, issues);
        },
  };
};
