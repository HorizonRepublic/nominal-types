import { trustedConstructorFor } from '../../core/type-functions.ts';
import type { JsonNode } from './json-node.ts';
import {
  holdsNominal,
  isJsonNode,
  isObjectNode,
  listOf,
  metaOf,
  nominalNameOf,
  unsupported,
} from './json-node.ts';
import { objectPlan } from './object-plan.ts';
import type { Plan } from './plan-contract.ts';
import { constraintsKey, registry } from './registry.ts';
import { sequencePlan } from './sequence-plan.ts';
import { unionPlan } from './union-plan.ts';

export type { Plan } from './plan-contract.ts';

const leafPlan = (name: string): Plan => {
  const target = registry.types.get(name);

  if (target === undefined) {
    throw new TypeError(`arkSchema: no type named ${name} was given to arkOf()`);
  }

  return { build: trustedConstructorFor(target), verify: undefined };
};

const morphPlan = (node: JsonNode): Plan | undefined => {
  const name = nominalNameOf(listOf(node['morphs']).at(-1));

  if (name !== undefined) {
    return leafPlan(name);
  }

  if (holdsNominal(node)) {
    throw unsupported('a morph');
  }

  return undefined;
};

/**
 * Internal: the plan for a node of ArkType's `.json`, or `undefined` where nothing below it needs
 * building or verifying.
 *
 * @throws TypeError for an `arkOf()` node in a place whose branch can't be told at runtime.
 */
export const planOf = (node: unknown): Plan | undefined => {
  if (Array.isArray(node)) {
    return unionPlan(node, planOf);
  }

  if (!isJsonNode(node)) {
    return undefined;
  }

  const name = nominalNameOf(node);

  if (name !== undefined) {
    return leafPlan(name);
  }

  if ('morphs' in node) {
    return morphPlan(node);
  }

  if ('sequence' in node) {
    return sequencePlan(node['sequence'], planOf);
  }

  if (isObjectNode(node) || 'index' in node || metaOf(node, constraintsKey) !== undefined) {
    return objectPlan(node, planOf);
  }

  if (holdsNominal(node)) {
    throw unsupported('this node');
  }

  return undefined;
};
