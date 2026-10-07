import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { AnyNumber } from './any-number.ts';

const isFinite = (value: unknown): value is number => Number.isFinite(value);

const FiniteNumberBase: SubtypeOf<typeof AnyNumber, 'nominal.FiniteNumber'> = AnyNumber.subtype(
  'nominal.FiniteNumber',
  satisfying(isFinite, 'a finite number', { type: 'number', format: 'double' }),
);

/**
 * A number other than `NaN` and the infinities: every number JSON can carry.
 */
export class FiniteNumber extends FiniteNumberBase {}
