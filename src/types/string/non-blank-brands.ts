import { standIn } from '../../core/brand-stand-in.ts';
import type { NonBlankString } from './non-blank-string.ts';

const brands = ['nominal.NonEmptyString', 'nominal.NonBlankString'];

/**
 * `NonBlankString` in `implies`, by its brands: the string types whose values always hold a
 * character other than white space list it, without loading `NonBlankString` itself.
 *
 * @internal
 */
// `implies` reads only the name and the brands of what it lists, which the stand-in has; typing it
// as the class gives the implying types its brands at compile time.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const nonBlankString = standIn(...brands) as typeof NonBlankString;
