import type { StandardSchemaV1 } from './standard-spec.ts';

/**
 * What a schema run returns instead of a value when the value is rejected.
 *
 * @remarks
 * An accepted value travels back as itself, so the common path allocates nothing.
 *
 * @internal
 */
export class Rejection {
  /**
   * What is wrong with the value.
   */
  public readonly issues: readonly StandardSchemaV1.Issue[];

  public constructor(issues: readonly StandardSchemaV1.Issue[]) {
    this.issues = issues;
  }
}
