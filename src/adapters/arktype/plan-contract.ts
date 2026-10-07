import type { Verify } from './verify.ts';

/**
 * Internal: what happens to one place of a value ArkType accepted: `build` puts instances where
 * `toArk()` nodes stand, `verify` runs the constraints at and below it.
 */
export interface Plan {
  readonly build: (value: unknown) => unknown;
  readonly verify: Verify | undefined;
}

/**
 * Internal: the plan for a node of ArkType's `.json`, or `undefined` where nothing below it needs
 * building or verifying.
 */
export type PlanOf = (node: unknown) => Plan | undefined;
