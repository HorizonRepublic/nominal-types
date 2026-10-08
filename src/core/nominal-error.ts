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
 *
 * @example
 * ```ts
 * import { Email, NominalError } from '@horizon-republic/nominal-types';
 *
 * try {
 *   new Email('jane');
 * } catch (error) {
 *   if (error instanceof NominalError) {
 *     error.issues; // [{ message: 'must be an email address (was a string of 4 characters)' }]
 *   }
 * }
 * ```
 */
export class NominalError extends TypeError {
  /**
   * The name of the type that refused the value, such as `nominal.Email`, or the function that
   * built the schema, such as `n.object()`.
   */
  public readonly typeName: string;
  /**
   * What was wrong with the value: one issue per broken rule, each with its message, and with a
   * path for a value inside an object or array.
   */
  public readonly issues: readonly StandardSchemaV1.Issue[];

  /**
   * Builds the error with a message that joins the type name and every issue.
   *
   * @param typeName - The name of the type or function that refused the value.
   * @param issues - What was wrong with the value.
   */
  public constructor(typeName: string, issues: readonly StandardSchemaV1.Issue[]) {
    super(`${typeName}: ${issues.map((issue) => issueText(issue)).join('; ')}`);
    this.name = 'NominalError';
    this.typeName = typeName;
    this.issues = issues;
  }

  /**
   * Whether a value is a `NominalError`, also one thrown by another copy of this package.
   *
   * @param value - The value to test.
   * @returns `true` for an error of this package; a subclass checks its own prototype chain.
   */
  public static override [Symbol.hasInstance](value: unknown): boolean {
    if (this !== NominalError) {
      return Function.prototype[Symbol.hasInstance].call(this, value);
    }

    return typeof value === 'object' && value !== null && Reflect.get(value, mark) === true;
  }
}

Object.defineProperty(NominalError.prototype, mark, { value: true });

/**
 * What `parseAsync()` returns for the result of a run, a Promise of the value or one
 * rejected with a `NominalError` under `name`.
 *
 * @internal
 */
export const settled = <Value>(result: Value | Rejection, name: string): Promise<Value> =>
  result instanceof Rejection
    ? Promise.reject(new NominalError(name, result.issues))
    : Promise.resolve(result);
