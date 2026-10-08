import { PredicateSchema } from '../../core/predicate-schema.ts';

/**
 * The JSON Schema of a bigint rule, as an integer string and as a JSON integer.
 *
 * @internal
 */
export interface BigIntJson {
  /**
   * The keywords for the value written as an integer string.
   */
  readonly string: Readonly<Record<string, unknown>>;

  /**
   * The keywords for the value written as a JSON integer, on the input side only.
   */
  readonly integer: Readonly<Record<string, unknown>>;

  /**
   * Example values, added to both sides.
   */
  readonly examples?: readonly unknown[];
}

/**
 * The JSON Schema of a bigint rule for one side: the integer string or the JSON integer on
 * input, and on output the string `toJSON` writes.
 *
 * @internal
 */
export const bigintJsonOf = (
  json: BigIntJson,
  side: 'input' | 'output',
): Record<string, unknown> => {
  const examples = json.examples === undefined ? {} : { examples: json.examples };

  return side === 'output'
    ? { ...json.string, ...examples }
    : { anyOf: [json.string, json.integer], ...examples };
};

class BigIntRule extends PredicateSchema<bigint> {
  readonly #json: BigIntJson;

  public constructor(description: string, test: (value: bigint) => boolean, json: BigIntJson) {
    super(
      (value: unknown): value is bigint => typeof value === 'bigint' && test(value),
      description,
    );
    this.#json = json;
  }

  protected override jsonBody(side: 'input' | 'output'): Record<string, unknown> {
    return { ...bigintJsonOf(this.#json, side), description: this.description };
  }
}

/**
 * A rule for bigints that pass `test`.
 *
 * @internal
 */
export const bigintRule = (
  description: string,
  test: (value: bigint) => boolean,
  json: BigIntJson,
): PredicateSchema<bigint> => new BigIntRule(description, test, json);
