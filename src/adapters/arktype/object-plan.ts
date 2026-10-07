import type { JsonNode } from './json-node.ts';
import { isJsonNode, listOf, unsupported } from './json-node.ts';
import type { Plan, PlanOf } from './plan-contract.ts';
import type { Verify } from './verify.ts';
import { combine, constraintsOf, verifyConstraints, verifyKeys } from './verify.ts';

interface Field {
  readonly key: string;
  readonly optional: boolean;
  readonly plan: Plan;
}

const fieldsOf = (node: JsonNode, kind: 'required' | 'optional', planOf: PlanOf): Field[] =>
  listOf(node[kind]).flatMap((entry) => {
    const plan = isJsonNode(entry) ? planOf(entry['value']) : undefined;

    return plan === undefined || !isJsonNode(entry)
      ? []
      : [{ key: String(entry['key']), optional: kind === 'optional', plan }];
  });

const declaredKeys = (node: JsonNode): ReadonlySet<string> =>
  new Set(
    [...listOf(node['required']), ...listOf(node['optional'])].flatMap((entry) =>
      isJsonNode(entry) ? [String(entry['key'])] : [],
    ),
  );

const indexPlan = (node: JsonNode, planOf: PlanOf): Plan | undefined => {
  const plans = listOf(node['index']).map((entry) =>
    isJsonNode(entry) ? planOf(entry['value']) : undefined,
  );

  if (plans.length > 1 && plans.some((plan) => plan !== undefined)) {
    throw unsupported('an object with more than one index signature');
  }

  return plans[0];
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const builder =
  (fields: readonly Field[], index: Plan | undefined, declared: ReadonlySet<string>) =>
  (value: unknown): unknown => {
    if (!isRecord(value)) {
      return value;
    }

    const built: Record<string, unknown> = { ...value };

    for (const { key, optional, plan } of fields) {
      const item = value[key];

      if (!optional || item !== undefined) {
        built[key] = plan.build(item);
      }
    }

    if (index !== undefined) {
      for (const key of Object.keys(value)) {
        if (!declared.has(key)) {
          built[key] = index.build(value[key]);
        }
      }
    }

    return built;
  };

const indexVerifier =
  (verify: Verify, declared: ReadonlySet<string>): Verify =>
  (value, path, issues) => {
    const keys = isRecord(value) ? Object.keys(value).filter((key) => !declared.has(key)) : [];

    verifyKeys(keys.map((key) => [key, verify] as const))(value, path, issues);
  };

/**
 * Internal: the plan for an object node: its fields, its index signature and its constraints.
 *
 * @throws TypeError for more than one index signature holding an `arkOf()` node.
 */
export const objectPlan = (node: JsonNode, planOf: PlanOf): Plan | undefined => {
  const fields = [...fieldsOf(node, 'required', planOf), ...fieldsOf(node, 'optional', planOf)];
  const declared = declaredKeys(node);
  const index = indexPlan(node, planOf);
  const constraints = constraintsOf(node);

  if (fields.length === 0 && index === undefined && constraints.length === 0) {
    return undefined;
  }

  const fieldVerifiers = fields.flatMap(({ key, plan }) =>
    plan.verify === undefined ? [] : [[key, plan.verify] as const],
  );

  return {
    build: builder(fields, index, declared),
    verify: combine(
      combine(
        fieldVerifiers.length === 0 ? undefined : verifyKeys(fieldVerifiers),
        index?.verify === undefined ? undefined : indexVerifier(index.verify, declared),
      ),
      constraints.length === 0 ? undefined : verifyConstraints(constraints),
    ),
  };
};
