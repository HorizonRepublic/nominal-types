import { PredicateSchema } from '../../core/predicate-schema.ts';

/**
 * Internal: the JSON Schema of a bigint rule, as an integer string and as a JSON integer.
 */
export interface BigIntJson {
  readonly string: Readonly<Record<string, unknown>>;
  readonly integer: Readonly<Record<string, unknown>>;
  readonly examples?: readonly unknown[];
}

/**
 * Internal: the input of a big integer type comes as a string or as a safe integer, while its
 * output is always the string `toJSON` writes.
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
 * Internal: a rule for bigints that pass `test`.
 */
export const bigintRule = (
  description: string,
  test: (value: bigint) => boolean,
  json: BigIntJson,
): PredicateSchema<bigint> => new BigIntRule(description, test, json);
