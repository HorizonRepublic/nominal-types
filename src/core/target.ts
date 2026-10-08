import type { AnyNominalType, Parsed, ValueOf } from './contracts.ts';
import { isNominalType } from './nominal.ts';
import { isTypeSchema } from './type-schema.ts';
import type { TypeSchema } from './type-schema.ts';

/**
 * What an adapter checks a value against: a nominal type, or a schema built by `n.of()`.
 */
export type NominalTarget = AnyNominalType | TypeSchema<unknown, unknown>;

/**
 * The value a target produces: an instance of a nominal type, or what a `n.of()` schema gives,
 * such as a list of instances.
 *
 * @typeParam Target - The nominal type or `n.of()` schema.
 */
export type TargetValue<Target extends NominalTarget> = Target extends AnyNominalType
  ? Target['prototype']
  : ValueOf<Target>;

/**
 * Whether a value is a nominal type or a `n.of()` schema, also from another copy of
 * this package.
 *
 * @internal
 */
export const isTarget = (value: unknown): value is NominalTarget =>
  isNominalType(value) || isTypeSchema(value);

/**
 * Checks a value against a nominal type or a `n.of()` schema.
 *
 * @internal
 */
export const parseTarget = (target: NominalTarget, input: unknown): Parsed<unknown> =>
  isTypeSchema(target) ? target.parse(input) : target.parse(input);
