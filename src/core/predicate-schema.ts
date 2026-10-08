import { mustBe } from './messages.ts';
import { NativeSchema } from './native-schema.ts';
import { NoJsonSchema } from './no-json-schema.ts';

/**
 * A Standard Schema that accepts the values a type guard approves.
 *
 * @remarks
 * Nominal types recognise it and call the guard directly, without going through `validate`, so a
 * type declared from a guard costs about as much as the guard itself. Without a JSON Schema body,
 * the schema refuses to describe itself.
 *
 * @typeParam Value - The values the guard approves.
 *
 * @example
 * ```ts
 * import { n } from '@horizon-republic/nominal-types';
 *
 * const isEven = (value: unknown): value is number =>
 *   typeof value === 'number' && Number.isInteger(value) && value % 2 === 0;
 *
 * const even = n.satisfying(isEven, 'an even number');
 *
 * even.accepts(4); // true
 * even.description; // 'an even number'
 * ```
 */
export class PredicateSchema<Value> extends NativeSchema<Value> {
  /**
   * The type guard; a plain function, so it can be called on its own.
   */
  public readonly accepts: (value: unknown) => value is Value;
  /**
   * What an approved value is, completing "must be …" in messages.
   */
  public readonly description: string;
  readonly #json: Readonly<Record<string, unknown>> | undefined;

  /**
   * Builds the schema; `n.satisfying()` does the same and reads better in a chain.
   *
   * @param check - The type guard that approves a value.
   * @param description - What an approved value is, completing "must be …" in messages.
   * @param json - The JSON Schema the guard corresponds to; without it the schema has none.
   */
  public constructor(
    check: (value: unknown) => value is Value,
    description: string,
    json?: Readonly<Record<string, unknown>>,
  ) {
    super();
    this.accepts = check;
    this.description = description;
    this.#json = json;
  }

  public messageFor(value: unknown, describe?: (value: unknown) => string): string {
    return mustBe(this.descriptionFor(value), value, describe);
  }

  public descriptionFor(_value: unknown): string {
    return this.description;
  }

  protected jsonBody(_side: 'input' | 'output'): Record<string, unknown> {
    if (this.#json === undefined) {
      throw new NoJsonSchema();
    }

    return { ...this.#json, description: this.description };
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
 * @typeParam Value - The values the guard approves.
 * @param check - The type guard that approves a value.
 * @param description - What an approved value is, completing "must be …" in messages.
 * @param json - The JSON Schema the guard corresponds to; without it the schema has none.
 * @returns The schema of the values the guard approves.
 *
 * @example
 * ```ts
 * import { n, Nominal } from '@horizon-republic/nominal-types';
 *
 * const isEven = (value: unknown): value is number =>
 *   typeof value === 'number' && Number.isInteger(value) && value % 2 === 0;
 *
 * export class EvenNumber extends Nominal(
 *   'EvenNumber',
 *   n.satisfying(isEven, 'an even number', { type: 'integer', multipleOf: 2 }),
 * ) {}
 * ```
 */
export const satisfying = <Value>(
  check: (value: unknown) => value is Value,
  description: string,
  json?: Readonly<Record<string, unknown>>,
): PredicateSchema<Value> => new PredicateSchema(check, description, json);
