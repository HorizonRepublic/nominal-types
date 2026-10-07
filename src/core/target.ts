import type { AnyNominalType, Parsed } from './contracts.ts';
import { isNominalType } from './nominal.ts';
import { isTypeSchema } from './type-schema.ts';
import type { TypeSchema } from './type-schema.ts';

/**
 * What an adapter checks a value against: a nominal type, or a schema built by `schemaOf()`.
 */
export type NominalTarget = AnyNominalType | TypeSchema<unknown, unknown>;

/**
 * Internal: whether a value is a nominal type or a `schemaOf()` schema, also from another copy of
 * this package.
 */
export const isTarget = (value: unknown): value is NominalTarget =>
  isNominalType(value) || isTypeSchema(value);

/**
 * Internal: checks a value against a nominal type or a `schemaOf()` schema.
 */
export const parseTarget = (target: NominalTarget, input: unknown): Parsed<unknown> =>
  isTypeSchema(target) ? target.parse(input) : target.parse(input);
