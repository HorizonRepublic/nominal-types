import { mustBe } from '../../core/messages.ts';
import { PredicateSchema } from '../../core/predicate-schema.ts';

const separated = /[\s-]/u;

/**
 * Internal: the rule of `Isbn`, which tells text with hyphens or spaces apart from a wrong check
 * digit in its message.
 */
export class IsbnRule extends PredicateSchema<string> {
  public override messageFor(value: unknown): string {
    return typeof value === 'string' && separated.test(value)
      ? mustBe('an ISBN without hyphens or spaces', value)
      : super.messageFor(value);
  }
}
