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
 */
export class PredicateSchema<Value> extends NativeSchema<Value> {
  public readonly accepts: (value: unknown) => value is Value;
  public readonly description: string;
  readonly #json: Readonly<Record<string, unknown>> | undefined;

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

  public messageFor(value: unknown): string {
    return mustBe(this.description, value);
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
