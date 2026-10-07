import type { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * Thrown when a nominal type is constructed from a value its schema rejects.
 *
 * @remarks
 * Only `new` throws it. Boundaries that expect bad input, such as `parse` and the adapters, return
 * the same issues as a value instead, since building an exception costs far more than a check.
 */
export class NominalError extends TypeError {
  public readonly typeName: string;
  public readonly issues: readonly StandardSchemaV1.Issue[];

  public constructor(typeName: string, issues: readonly StandardSchemaV1.Issue[]) {
    super(`${typeName}: ${issues.map((issue) => issue.message).join('; ')}`);
    this.name = 'NominalError';
    this.typeName = typeName;
    this.issues = issues;
  }
}
