import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { FiniteNumber } from './finite-number.ts';

const isSafeInteger = (value: unknown): value is number => Number.isSafeInteger(value);

const IntegerBase: SubtypeOf<typeof FiniteNumber, 'nominal.Integer'> = FiniteNumber.subtype(
  'nominal.Integer',
  satisfying(isSafeInteger, 'a safe integer', {
    type: 'integer',
    minimum: Number.MIN_SAFE_INTEGER,
    maximum: Number.MAX_SAFE_INTEGER,
  }),
);

/**
 * A whole number within `Number.MIN_SAFE_INTEGER` and `Number.MAX_SAFE_INTEGER`, where every
 * integer has an exact `number` of its own.
 *
 * @remarks
 * Larger counts lose precision silently, so they are rejected rather than rounded.
 */
export class Integer extends IntegerBase {}
