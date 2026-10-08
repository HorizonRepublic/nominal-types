import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { NonEmptyString } from './non-empty-string.ts';

// The 25 code points with the Unicode White_Space property, spelled out because not every JSON
// Schema validator reads \p{...} classes, and JavaScript's \s is a different set.
const pattern = /[^\t-\r \u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/u;

const NonBlankStringBase: SubtypeOf<typeof NonEmptyString, 'nominal.NonBlankString'> =
  NonEmptyString.subtype(
    'nominal.NonBlankString',
    matching(pattern, 'a non-blank string', { examples: ['Jane'] }),
  );

/**
 * A string with at least one character that is not white space, for a name or a title that
 * spaces alone can't fill.
 *
 * @remarks
 * White space means the 25 code points with the Unicode `White_Space` property. That set differs
 * from what `String.prototype.trim()` removes: U+0085 (next line) counts as white space here, and
 * U+FEFF (byte order mark) and U+200B (zero-width space) do not. The value is kept as given and
 * never trimmed.
 */
export class NonBlankString extends NonBlankStringBase {
  declare public static readonly '~standard': StandardOf<typeof NonBlankString>;

  /**
   * Matches any character outside Unicode `White_Space`.
   */
  public static readonly pattern: RegExp = pattern;
}
