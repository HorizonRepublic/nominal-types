import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { hasMod11CheckCharacter } from './check-digits.ts';
import { nonBlankString } from './non-blank-brands.ts';
import type { NonBlankString } from './non-blank-string.ts';

const pattern = /^\d{4}-\d{3}[\dX]$/u;

const isIssnText = (value: unknown): value is string =>
  typeof value === 'string' && pattern.test(value) && hasMod11CheckCharacter(value);

const IssnBase: SubtypeOf<typeof AnyString, 'nominal.Issn', string, typeof NonBlankString> =
  AnyString.subtype(
    'nominal.Issn',
    stringOnly(
      satisfying(isIssnText, 'an ISSN with a valid check digit', {
        type: 'string',
        pattern: pattern.source,
        minLength: 9,
        maxLength: 9,
        examples: ['0378-5955'],
      }),
    ),
    { implies: [nonBlankString] },
  );

/**
 * An International Standard Serial Number of ISO 3297, which names a journal or another serial,
 * such as `0378-5955`: two groups of four characters joined by a hyphen, the last one a check
 * character.
 *
 * @remarks
 * The hyphen is required and the check character `X` is upper case, as ISO 3297 writes them, so
 * one ISSN has one spelling: `03785955` and `0378-595x` are refused rather than read as
 * `0378-5955` and `0378-595X`.
 *
 * @example
 * ```ts
 * import { Issn } from '@horizon-republic/nominal-types';
 *
 * new Issn('2049-3630').value; // '2049-3630'
 * ```
 */
export class Issn extends IssnBase {
  /**
   * The Standard Schema interface, typed with this class so validators see its own members.
   */
  declare public static readonly '~standard': StandardOf<typeof Issn>;

  /**
   * The shape of an ISSN, which the JSON Schema carries; the check character is checked apart
   * from it.
   */
  public static readonly pattern: RegExp = pattern;
}
