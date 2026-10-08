import type { NominalSchema, NominalType } from '../../core/contracts.ts';
import { Nominal } from '../../core/nominal.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { defineTextForm } from '../../core/text-form.ts';

const booleanFromText = (text: string): boolean | undefined => {
  if (text === 'true') {
    return true;
  }

  return text === 'false' ? false : undefined;
};

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const AnyBooleanBase: NominalType<'nominal.AnyBoolean', NominalSchema<boolean, boolean>> = Nominal(
  'nominal.AnyBoolean',
  satisfying(isBoolean, 'a boolean', { type: 'boolean' }),
);

/**
 * `true` or `false`: the type a flag with a meaning of its own is declared under.
 *
 * @remarks
 * `n.of(Type).fromString()` reads the text `'true'` and `'false'`, and nothing else.
 *
 * @example
 * ```ts
 * import { AnyBoolean } from '@horizon-republic/nominal-types';
 *
 * export class Consent extends AnyBoolean.subtype('Consent') {}
 *
 * new Consent(true).value; // true
 * Consent.parse('yes').ok; // false
 * ```
 */
export class AnyBoolean extends AnyBooleanBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof AnyBoolean>;
}

defineTextForm(AnyBoolean, booleanFromText);
