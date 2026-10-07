import type { NominalSchema, NominalType } from '../../core/contracts.ts';
import { Nominal } from '../../core/nominal.ts';
import { stringRule } from '../../core/string-rule.ts';

const AnyStringBase: NominalType<'AnyString', NominalSchema<string, string>> = Nominal(
  'AnyString',
  stringRule,
);

/**
 * Any string, the empty one included: the type every string type is declared under.
 *
 * @remarks
 * A subtype adds its rule on top of this one, and a pattern makes the string check free, since
 * the chain leaves it to the pattern.
 *
 * @example
 * ```ts
 * export class Slug extends AnyString.subtype('Slug', /^[a-z0-9]+(?:-[a-z0-9]+)*$/u) {}
 * ```
 */
export class AnyString extends AnyStringBase {}
