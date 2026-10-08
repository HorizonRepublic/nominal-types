import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';

const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value !== '';

const NonEmptyStringBase: SubtypeOf<typeof AnyString, 'nominal.NonEmptyString'> = AnyString.subtype(
  'nominal.NonEmptyString',
  stringOnly(
    satisfying(isNonEmpty, 'a non-empty string', {
      type: 'string',
      minLength: 1,
      examples: ['Jane'],
    }),
  ),
);

/**
 * A string of at least one character, for a required text field where `''` means nothing was
 * entered.
 *
 * @remarks
 * A string of spaces passes; reach for `NonBlankString` where it should not. The value is kept as
 * given and never trimmed.
 *
 * @example
 * ```ts
 * import { NonEmptyString } from '@horizon-republic/nominal-types';
 *
 * const name = new NonEmptyString('Jane');
 * NonEmptyString.accepts(''); // false
 * ```
 */
export class NonEmptyString extends NonEmptyStringBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof NonEmptyString>;
}
