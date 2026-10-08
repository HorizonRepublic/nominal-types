import type { NominalSchema, NominalType } from '../../core/contracts.ts';
import { Nominal } from '../../core/nominal.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { defineTextForm } from '../../core/text-form.ts';

const numberText = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[Ee][+-]?\d+)?$/u;

const numberFromText = (text: string): number | undefined =>
  numberText.test(text) ? Number(text) : undefined;

const isNumber = (value: unknown): value is number => typeof value === 'number';

const AnyNumberBase: NominalType<'nominal.AnyNumber', NominalSchema<number, number>> = Nominal(
  'nominal.AnyNumber',
  satisfying(isNumber, 'a number', { type: 'number' }),
);

/**
 * Any value of type `number`, `NaN` and the infinities included: the root of the number types.
 *
 * @remarks
 * JSON has no `NaN` or infinity, and `JSON.stringify` writes them as `null`; reach for
 * `FiniteNumber` where a value travels as JSON. `n.of(Type).fromString()` reads a number
 * written the way JSON writes one, such as `'2'`, `'-1.5'` or `'1e3'`.
 */
export class AnyNumber extends AnyNumberBase {}

defineTextForm(AnyNumber, numberFromText);
