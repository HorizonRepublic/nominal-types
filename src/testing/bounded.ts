import { Arbitrary } from 'fast-check';
import type { Random, Stream, Value } from 'fast-check';

/**
 * Internal: how many generated values in a row may fail before generation gives up.
 */
export const attempts = 1000;

// fast-check's own filter retries forever, which hangs a test on a rule that refuses almost
// everything; this one gives up with an error that names what refused the values.
class BoundedFilter<Item> extends Arbitrary<Item> {
  readonly #source: Arbitrary<Item>;
  readonly #keep: (value: Item) => boolean;
  readonly #failure: string;

  public constructor(source: Arbitrary<Item>, keep: (value: Item) => boolean, failure: string) {
    super();
    this.#source = source;
    this.#keep = keep;
    this.#failure = failure;
  }

  public generate(random: Random, biasFactor: number | undefined): Value<Item> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const generated = this.#source.generate(random, biasFactor);

      if (this.#keep(generated.value)) {
        return generated;
      }
    }

    throw new Error(this.#failure);
  }

  public canShrinkWithoutContext(value: unknown): value is Item {
    return this.#source.canShrinkWithoutContext(value) && this.#keep(value);
  }

  public shrink(value: Item, context: unknown): Stream<Value<Item>> {
    return this.#source.shrink(value, context).filter((shrunk) => this.#keep(shrunk.value));
  }
}

/**
 * Internal: the values of `source` that `keep` approves; after `attempts` refusals in a row,
 * generation throws an error with the message `failure`.
 */
export const bounded = <Item>(
  source: Arbitrary<Item>,
  keep: (value: Item) => boolean,
  failure: string,
): Arbitrary<Item> => new BoundedFilter(source, keep, failure);

/**
 * Internal: the message for a target that refused every value made for it.
 */
export const refusedBy = (target: string): string =>
  `arbitraryOf(): ${target} refused ${attempts} generated values in a row, so its rules or constraints refuse almost everything the generator makes. Pass a generator of your own: { overrides: new Map([[schema, arbitrary]]) }`;
