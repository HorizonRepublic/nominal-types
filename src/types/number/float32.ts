import type { SubtypeOf } from '../../core/contracts.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import { FiniteNumber } from './finite-number.ts';

const isFloat32 = (value: unknown): value is number =>
  typeof value === 'number' && Math.fround(value) === value;

const Float32Base: SubtypeOf<typeof FiniteNumber, 'Float32'> = FiniteNumber.subtype(
  'Float32',
  satisfying(isFloat32, 'a 32-bit float', { type: 'number', format: 'float' }),
);

/**
 * A finite number a 32-bit float holds exactly, for `real` columns and `Float32Array`.
 *
 * @remarks
 * Most decimals have no exact 32-bit form, so `0.1` is rejected while `0.5` passes; round with
 * `Math.fround` before constructing. JSON Schema can't say this, so it describes a plain number
 * with the `float` format.
 */
export class Float32 extends Float32Base {}
