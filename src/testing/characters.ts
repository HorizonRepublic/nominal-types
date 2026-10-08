import { Arbitrary, Stream, Value } from 'fast-check';
import type { Random } from 'fast-check';

// Text drawn one character at a time from the random generator, several times faster than
// fast-check's string generators, which build a value for every character. Short text comes up
// more often than long, and the shortest and the longest now and then on their own.
class Characters extends Arbitrary<string> {
  readonly #alphabet: string;
  readonly #min: number;
  readonly #max: number;

  public constructor(alphabet: string, min: number, max: number) {
    super();
    this.#alphabet = alphabet;
    this.#min = min;
    this.#max = max;
  }

  public generate(random: Random): Value<string> {
    const edge = random.nextInt(0, 15);
    const spread = this.#max - this.#min + 1;
    let length = this.#min + Math.floor(spread * (random.nextInt(0, 1_000_000) / 1_000_001) ** 3);

    if (edge === 0) {
      length = this.#min;
    } else if (edge === 1) {
      length = this.#max;
    }

    let text = '';

    for (let index = 0; index < length; index += 1) {
      text += this.#alphabet[random.nextInt(0, this.#alphabet.length - 1)] ?? '';
    }

    return new Value(text, undefined);
  }

  public canShrinkWithoutContext(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length >= this.#min &&
      value.length <= this.#max &&
      Array.from(value).every((character) => this.#alphabet.includes(character))
    );
  }

  public shrink(value: string): Stream<Value<string>> {
    return value.length > this.#min
      ? Stream.of(
          new Value(value.slice(0, this.#min), undefined),
          new Value(value.slice(0, -1), undefined),
        )
      : Stream.nil();
  }
}

/**
 * Internal: text of `min` to `max` characters of `alphabet`, each character one UTF-16 unit.
 */
export const characters = (alphabet: string, min: number, max: number = min): Arbitrary<string> =>
  new Characters(alphabet, min, max);

/**
 * Internal: the alphabets the built-in generators draw from.
 */
export const alphabets = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  letters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  hex: '0123456789abcdefABCDEF',
} as const;
