import type { NominalSchema, NominalType } from '../../core/contracts.ts';
import { Nominal } from '../../core/nominal.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { defineTextForm } from '../../core/text-form.ts';

const booleanFromText = (text: string): boolean | undefined => {
  if (text === 'true') {
    return true;
  }
  return text === 'false' ? false : undefined;
};

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const AnyBooleanBase: NominalType<'AnyBoolean', NominalSchema<boolean, boolean>> = Nominal(
  'AnyBoolean',
  satisfying(isBoolean, 'a boolean', { type: 'boolean' }),
);

/**
 * `true` or `false`: the type a flag with a meaning of its own is declared under.
 *
 * @remarks
 * `schemaOf(Type).fromString()` reads the text `'true'` and `'false'`, and nothing else.
 *
 * @example
 * ```ts
 * export class Consent extends AnyBoolean.subtype('Consent') {}
 * ```
 */
export class AnyBoolean extends AnyBooleanBase {}

defineTextForm(AnyBoolean, booleanFromText);
