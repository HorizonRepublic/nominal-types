import { issueText } from './issue-text.ts';
import { Rejection } from './rejection.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';

const mark = Symbol.for('@horizon-republic/nominal-types/NominalError');

/**
 * Thrown when a nominal type is constructed from a value its schema rejects.
 *
 * @remarks
 * `new` throws it, and `parseAsync()` rejects with it. Boundaries that expect bad input, such as
 * `parse` and the adapters, return the same issues as a value instead, since building an exception
 * costs far more than a check.
 *
 * `instanceof NominalError` also holds for an error thrown by another copy of this package, such
 * as the CommonJS build loaded next to the ES module one.
 */
export class NominalError extends TypeError {
  public readonly typeName: string;
  public readonly issues: readonly StandardSchemaV1.Issue[];

  public constructor(typeName: string, issues: readonly StandardSchemaV1.Issue[]) {
    super(`${typeName}: ${issues.map((issue) => issueText(issue)).join('; ')}`);
    this.name = 'NominalError';
    this.typeName = typeName;
    this.issues = issues;
  }

  public static override [Symbol.hasInstance](value: unknown): boolean {
    if (this !== NominalError) {
      return Function.prototype[Symbol.hasInstance].call(this, value);
    }

    return typeof value === 'object' && value !== null && Reflect.get(value, mark) === true;
  }
}

Object.defineProperty(NominalError.prototype, mark, { value: true });

/**
 * Internal: what `parseAsync()` returns for the result of a run, a Promise of the value or one
 * rejected with a `NominalError` under `name`.
 */
export const settled = <Value>(result: Value | Rejection, name: string): Promise<Value> =>
  result instanceof Rejection
    ? Promise.reject(new NominalError(name, result.issues))
    : Promise.resolve(result);
