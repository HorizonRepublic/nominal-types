import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import { describeValue, forTarget } from './schema-text.ts';
import type { StandardProps } from './standard-schema.ts';

/**
 * A Standard Schema that accepts the values a type guard approves.
 *
 * @remarks
 * Nominal types recognise it and call the guard directly, without going through `validate`, so a
 * type declared from a guard costs about as much as the guard itself. Without a JSON Schema body,
 * the schema refuses to describe itself.
 */
export class PredicateSchema<Value> {
  public readonly check: (value: unknown) => value is Value;
  public readonly description: string;
  public readonly '~standard': StandardProps<Value, Value>;
  readonly #json: Readonly<Record<string, unknown>> | undefined;

  public constructor(
    check: (value: unknown) => value is Value,
    description: string,
    json?: Readonly<Record<string, unknown>>,
  ) {
    this.check = check;
    this.description = description;
    this.#json = json;
    this['~standard'] = {
      version: 1,
      vendor: '@horizon-republic/nominal-types',
      validate: (value) =>
        this.check(value) ? { value } : { issues: [{ message: this.messageFor(value) }] },
      jsonSchema: {
        input: (options) => this.jsonSchema(options),
        output: (options) => this.jsonSchema(options),
      },
    };
  }

  /**
   * The message a rejected value is reported with.
   */
  public messageFor(value: unknown): string {
    return `must be ${this.description} (was ${describeValue(value)})`;
  }

  private jsonSchema(options: StandardJSONSchemaV1.Options): Record<string, unknown> {
    if (this.#json === undefined) {
      throw new TypeError('the schema cannot describe itself as JSON Schema');
    }
    return forTarget(options, { ...this.#json, description: this.description });
  }
}

/**
 * Builds a schema from a type guard, for rules a pattern cannot express and no validation library
 * is wanted for.
 *
 * @remarks
 * The description completes the sentence "must be …" in error messages. Pass the JSON Schema the
 * guard corresponds to, if the type should describe itself.
 *
 * @example
 * ```ts
 * const isEven = (value: unknown): value is number =>
 *   typeof value === 'number' && Number.isInteger(value) && value % 2 === 0;
 *
 * export class EvenNumber extends Nominal(
 *   'EvenNumber',
 *   satisfying(isEven, 'an even number', { type: 'integer', multipleOf: 2 }),
 * ) {}
 * ```
 */
export const satisfying = <Value>(
  check: (value: unknown) => value is Value,
  description: string,
  json?: Readonly<Record<string, unknown>>,
): PredicateSchema<Value> => new PredicateSchema(check, description, json);

/**
 * The issues a predicate schema reports for a value it rejects.
 */
export const predicateIssues = (
  schema: PredicateSchema<unknown>,
  value: unknown,
): readonly StandardSchemaV1.Issue[] => [{ message: schema.messageFor(value) }];
