import { PredicateSchema } from '../../core/predicate-schema.ts';

/**
 * Internal: the rule of a type whose printed form puts spaces or other separators into the text,
 * which tells such text apart from text that is wrong in other ways in its message.
 */
export class SeparatedRule extends PredicateSchema<string> {
  readonly #separators: RegExp;
  readonly #unseparated: string;

  public constructor(
    check: (value: unknown) => value is string,
    description: string,
    separated: { readonly separators: RegExp; readonly description: string },
    json: Readonly<Record<string, unknown>>,
  ) {
    super(check, description, json);
    this.#separators = separated.separators;
    this.#unseparated = separated.description;
  }

  public override descriptionFor(value: unknown): string {
    return typeof value === 'string' && this.#separators.test(value)
      ? this.#unseparated
      : this.description;
  }
}
