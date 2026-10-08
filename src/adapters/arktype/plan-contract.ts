import type { Verify } from './verify.ts';

/**
 * What happens to one place of a value ArkType accepted: `build` puts instances where
 * `toArk()` nodes stand, `verify` runs the constraints at and below it.
 *
 * @internal
 */
export interface Plan {
  /**
   * Puts instances where `toArk()` nodes stand in the accepted value.
   */
  readonly build: (value: unknown) => unknown;

  /**
   * Runs the constraints at and below this place, or `undefined` where there are none.
   */
  readonly verify: Verify | undefined;
}

/**
 * The plan for a node of ArkType's `.json`, or `undefined` where nothing below it needs
 * building or verifying.
 *
 * @internal
 */
export type PlanOf = (node: unknown) => Plan | undefined;
