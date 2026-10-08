import { PredicateSchema } from '../../core/predicate-schema.ts';

const separated = /[\s-]/u;

/**
 * The rule of `Isbn`, which tells text with hyphens or spaces apart from a wrong check
 * digit in its message.
 *
 * @internal
 */
export class IsbnRule extends PredicateSchema<string> {
  public override descriptionFor(value: unknown): string {
    return typeof value === 'string' && separated.test(value)
      ? 'an ISBN without hyphens or spaces'
      : this.description;
  }
}
