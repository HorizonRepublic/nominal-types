import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import type { StandardProps } from './standard-schema.ts';

const describeValue = (value: unknown): string =>
  typeof value === 'string' ? JSON.stringify(value) : typeof value;

const schemaUris: Readonly<Record<string, string | undefined>> = {
  'draft-2020-12': 'https://json-schema.org/draft/2020-12/schema',
  'draft-07': 'http://json-schema.org/draft-07/schema#',
  'openapi-3.0': undefined,
};

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

  public constructor(pattern: RegExp, description?: string) {
    if (pattern.flags !== '' && pattern.flags !== 'u') {
      throw new TypeError(
        `${String(pattern)}: only the u flag is supported, since JSON Schema patterns carry no flags`,
      );
    }
    this.pattern = pattern;
    this.description = description;
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
    if (!Object.hasOwn(schemaUris, options.target)) {
      throw new TypeError(`JSON Schema target ${options.target} is not supported`);
    }
    const uri = schemaUris[options.target];
    return {
      ...(uri === undefined ? {} : { $schema: uri }),
      type: 'string',
      pattern: this.pattern.source,
      ...(this.description === undefined ? {} : { description: this.description }),
    };
  }
}

/**
 * Builds a schema from a regular expression, for declaring a type or overriding its rules.
 *
 * @remarks
 * The description completes the sentence "must be …" in error messages; without one, the message
 * quotes the pattern.
 *
 * @example
 * ```ts
 * export class Sku extends Nominal('Sku', matching(/^SKU-\d{4}$/u, 'a SKU')) {}
 * ```
 */
export const matching = (pattern: RegExp, description?: string): PatternSchema =>
  new PatternSchema(pattern, description);

/**
 * The issues a pattern schema reports for a value it rejects.
 */
export const patternIssues = (
  schema: PatternSchema,
  value: unknown,
): readonly StandardSchemaV1.Issue[] => [{ message: schema.messageFor(value) }];
