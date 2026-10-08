import type { AnyNominalType, Parsed } from './contracts.ts';
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
 */
export type TargetValue<Target extends NominalTarget> =
  Target extends TypeSchema<unknown, infer Output>
    ? Output
    : Target extends AnyNominalType
      ? Target['prototype']
      : never;

/**
 * Internal: whether a value is a nominal type or a `n.of()` schema, also from another copy of
 * this package.
 */
export const isTarget = (value: unknown): value is NominalTarget =>
  isNominalType(value) || isTypeSchema(value);

/**
 * Internal: checks a value against a nominal type or a `n.of()` schema.
 */
export const parseTarget = (target: NominalTarget, input: unknown): Parsed<unknown> =>
  isTypeSchema(target) ? target.parse(input) : target.parse(input);
