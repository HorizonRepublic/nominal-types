import { generatedArrayBuilder } from './builders.ts';
import { isJsonNode, listOf } from './json-node.ts';
import type { Plan, PlanOf } from './plan-contract.ts';
import type { Verify } from './verify.ts';

const structuredKeys = ['prefix', 'optionals', 'defaultables', 'variadic', 'postfix'];

type PlanAt = (index: number, length: number) => Plan | undefined;

const verifier =
  (planAt: PlanAt): Verify =>
  (value, path, issues) => {
    if (!Array.isArray(value)) {
      return;
    }

    for (let index = 0; index < value.length; index += 1) {
      const verify = planAt(index, value.length)?.verify;

      if (verify !== undefined) {
        path.push(index);
        verify(value[index], path, issues);
        path.pop();
      }
    }
  };

const builder =
  (planAt: PlanAt) =>
  (value: unknown): unknown => {
    if (!Array.isArray(value)) {
      return value;
    }

    return value.map((item: unknown, index) => {
      const plan = planAt(index, value.length);

      return plan === undefined ? item : plan.build(item);
    });
  };

/**
 * Internal: the plan for an array or a tuple: its leading elements, the rest, and the elements
 * after the rest, counted from the end.
 */
export const sequencePlan = (sequence: unknown, planOf: PlanOf): Plan | undefined => {
  const structured =
    isJsonNode(sequence) && structuredKeys.some((key) => Object.hasOwn(sequence, key));
  const leading = structured
    ? [
        ...listOf(sequence['prefix']),
        ...listOf(sequence['defaultables']),
        ...listOf(sequence['optionals']),
      ].map((element) => planOf(element))
    : [];
  const trailing = structured ? listOf(sequence['postfix']).map((element) => planOf(element)) : [];
  const rest = planOf(structured ? sequence['variadic'] : sequence);
  const plans = [...leading, ...trailing, rest];

  if (plans.every((plan) => plan === undefined)) {
    return undefined;
  }

  const planAt: PlanAt = (index, length) => {
    if (index < leading.length) {
      return leading[index];
    }

    const fromEnd = length - index;

    return fromEnd <= trailing.length ? trailing[trailing.length - fromEnd] : rest;
  };

  const generated =
    leading.length === 0 && trailing.length === 0 && rest !== undefined
      ? generatedArrayBuilder(rest.build)
      : undefined;

  return {
    build: generated ?? builder(planAt),
    verify: plans.every((plan) => plan?.verify === undefined) ? undefined : verifier(planAt),
  };
};
