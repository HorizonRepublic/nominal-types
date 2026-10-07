import type { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * What a schema run returns instead of a value when the value is rejected.
 *
 * @remarks
 * Internal: an accepted value travels back as itself, so the common path allocates nothing.
 */
export class Rejection {
  public readonly issues: readonly StandardSchemaV1.Issue[];

  public constructor(issues: readonly StandardSchemaV1.Issue[]) {
    this.issues = issues;
  }
}
