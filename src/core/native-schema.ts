import { forTarget } from './json-target.ts';
import { Rejection } from './rejection.ts';
import { standardProps } from './standard-props.ts';
import type { StandardProps } from './standard-schema.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';

/**
 * The common ground of `PatternSchema` and `PredicateSchema`: a rule nominal types run directly,
 * without going through `validate`.
 *
 * @remarks
 * A subclass gives the test, the message for a rejected value and its JSON Schema body; the
 * Standard Schema interface is built from those.
 */
export abstract class NativeSchema<Value> {
  public readonly '~standard': StandardProps<Value, Value>;

  protected constructor() {
    this['~standard'] = standardProps<Value, Value>(
      (value) => (this.accepts(value) ? value : new Rejection(this.issuesFor(value))),
      (side, options) => forTarget(options, this.jsonBody(side)),
    );
  }

  /**
   * Whether the value passes the rule; a plain function, so it can be called on its own.
   */
  public abstract readonly accepts: (value: unknown) => value is Value;

  /**
   * The message a rejected value is reported with.
   */
  public abstract messageFor(value: unknown): string;

  /**
   * The issues a rejected value is reported with.
   */
  public issuesFor(value: unknown): readonly StandardSchemaV1.Issue[] {
    return [{ message: this.messageFor(value) }];
  }

  /**
   * The JSON Schema body for the input the rule takes or the output it gives; most rules describe
   * both the same way.
   */
  protected abstract jsonBody(side: 'input' | 'output'): Record<string, unknown>;
}
