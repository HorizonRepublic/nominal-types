import type { IssueCode } from './issue-codes.ts';
import { forTarget } from './json-target.ts';
import { customized, describeHidden, describeValue, issueOf, shownValue } from './messages.ts';
import { Rejection } from './rejection.ts';
import { settings } from './settings.ts';
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
   * The message a rejected value is reported with, the value written by `describe`, which a
   * sensitive type passes to leave the value out.
   */
  public abstract messageFor(value: unknown, describe?: (value: unknown) => string): string;

  /**
   * The issues a rejected value is reported with, the value written by `describe`; `typeName` is
   * the type whose rule this is, for a messages function.
   */
  public issuesFor(
    value: unknown,
    describe: (value: unknown) => string = describeValue,
    typeName?: string,
  ): readonly StandardSchemaV1.Issue[] {
    const message = this.messageFor(value, describe);

    if (!customized()) {
      return [{ message }];
    }

    const hiddenValue = settings.values === 'hide' ? undefined : describeHidden(value);

    return [
      issueOf(this.codeFor(value), message, {
        hiddenEnglish: this.messageFor(value, describeHidden),
        wording: {
          description: this.descriptionFor(value),
          value: shownValue(value, describe),
          hiddenValue,
          typeName,
        },
      }),
    ];
  }

  /**
   * The code of the issue a rejected value is reported with.
   */
  public codeFor(_value: unknown): IssueCode {
    return 'invalid';
  }

  /**
   * What a rejected value must be, as its message says it, such as `an email address`.
   */
  public abstract descriptionFor(value: unknown): string;

  /**
   * The JSON Schema body for the input the rule takes or the output it gives; most rules describe
   * both the same way.
   */
  protected abstract jsonBody(side: 'input' | 'output'): Record<string, unknown>;
}
