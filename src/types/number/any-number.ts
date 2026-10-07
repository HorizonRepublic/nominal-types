import type { NominalSchema, NominalType } from '../../core/contracts.ts';
import { Nominal } from '../../core/nominal.ts';
import { satisfying } from '../../core/predicate-schema.ts';

const isNumber = (value: unknown): value is number => typeof value === 'number';

const AnyNumberBase: NominalType<'AnyNumber', NominalSchema<number, number>> = Nominal(
  'AnyNumber',
  satisfying(isNumber, 'a number', { type: 'number' }),
);

/**
 * Any value of type `number`, `NaN` and the infinities included: the root of the number types.
 *
 * @remarks
 * JSON has no `NaN` or infinity, and `JSON.stringify` writes them as `null`; reach for
 * `FiniteNumber` where a value travels as JSON.
 */
export class AnyNumber extends AnyNumberBase {}
