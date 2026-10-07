import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import { describeValue, forTarget } from './schema-text.ts';
import type { StandardProps } from './standard-schema.ts';

/**
 * A Standard Schema that accepts the strings a regular expression matches.
 *
 * @remarks
 * Nominal types recognise it and test the pattern directly, without going through `validate`, so
 * a type declared from a pattern costs about as much as the pattern itself. Only the `u` flag is
 * allowed: `g` and `y` make a pattern stateful, and JSON Schema patterns carry no flags, so the
 * generated schema could not keep the meaning of `i`, `m`, `s` or `v`.
 */
export class PatternSchema {
  public readonly pattern: RegExp;
  public readonly description: string | undefined;
  public readonly '~standard': StandardProps<string, string>;
  readonly #json: Readonly<Record<string, unknown>>;

  public constructor(
    pattern: RegExp,
    description?: string,
    json: Readonly<Record<string, unknown>> = {},
  ) {
    if (pattern.flags !== '' && pattern.flags !== 'u') {
      throw new TypeError(
        `${String(pattern)}: only the u flag is supported, since JSON Schema patterns carry no flags`,
      );
    }
    this.pattern = pattern;
    this.description = description;
    this.#json = json;
    this['~standard'] = {
      version: 1,
      vendor: '@horizon-republic/nominal-types',
      validate: (value) =>
        this.accepts(value) ? { value } : { issues: [{ message: this.messageFor(value) }] },
      jsonSchema: {
        input: (options) => this.jsonSchema(options),
        output: (options) => this.jsonSchema(options),
      },
    };
  }

  /**
   * Whether the value is a string the pattern matches.
   */
  public accepts(value: unknown): value is string {
    return typeof value === 'string' && this.pattern.test(value);
  }

  /**
   * The message a rejected value is reported with.
   */
  public messageFor(value: unknown): string {
    if (typeof value !== 'string') {
      return `must be a string (was ${describeValue(value)})`;
    }
    const expected = this.description ?? `matched by ${this.pattern.source}`;
    return `must be ${expected} (was ${describeValue(value)})`;
  }

  private jsonSchema(options: StandardJSONSchemaV1.Options): Record<string, unknown> {
    return forTarget(options, {
      type: 'string',
      pattern: this.pattern.source,
      ...this.#json,
      ...(this.description === undefined ? {} : { description: this.description }),
    });
  }
}

/**
 * Builds a schema from a regular expression, for declaring a type or overriding its rules.
 *
 * @remarks
 * The description completes the sentence "must be …" in error messages; without one, the message
 * quotes the pattern. `json` adds keywords to the JSON Schema, such as a `format`, length limits
 * that the pattern already implies, or `examples`.
 *
 * @example
 * ```ts
 * export class Sku extends Nominal('Sku', matching(/^SKU-\d{4}$/u, 'a SKU')) {}
 * ```
 */
export const matching = (
  pattern: RegExp,
  description?: string,
  json?: Readonly<Record<string, unknown>>,
): PatternSchema => new PatternSchema(pattern, description, json);

/**
 * The issues a pattern schema reports for a value it rejects.
 */
export const patternIssues = (
  schema: PatternSchema,
  value: unknown,
): readonly StandardSchemaV1.Issue[] => [{ message: schema.messageFor(value) }];
