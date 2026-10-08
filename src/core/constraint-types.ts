import type { AnyNominalType, InputOf } from './contracts.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';
import type { NominalTarget, TargetValue } from './target.ts';
import type { TypeSchema } from './type-schema.ts';

/**
 * What a field of a constraint is checked against: a nominal type, a `n.of()` schema or any
 * synchronous Standard Schema, for fields that are no nominal type.
 */
export type ConstraintField = NominalTarget | StandardSchemaV1;

/**
 * The value a constraint's check receives for a field: an instance, what a `n.of()` schema
 * gives, or the output of another schema.
 */
export type ConstraintValue<Field extends ConstraintField> = Field extends NominalTarget
  ? TargetValue<Field>
  : Field extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<Field>
    : never;

/**
 * The values a constraint's check receives, one for each field it lists.
 */
export type ConstraintValues<Fields extends Readonly<Record<string, ConstraintField>>> = {
  readonly [Key in keyof Fields]: ConstraintValue<Fields[Key]>;
};

/**
 * What a constraint accepts for a field: what its type or schema takes as input.
 */
export type ConstraintInput<Field extends ConstraintField> =
  Field extends TypeSchema<infer Input, unknown>
    ? Input
    : Field extends AnyNominalType
      ? InputOf<Field['rule']> | Field['prototype']
      : Field extends StandardSchemaV1
        ? StandardSchemaV1.InferInput<Field>
        : never;

/**
 * What a constraint accepts: an object with an input for each field it lists.
 */
export type ConstraintInputs<Fields extends Readonly<Record<string, ConstraintField>>> = {
  readonly [Key in keyof Fields]: ConstraintInput<Fields[Key]>;
};

/**
 * What a constraint's check answers: `true` when the fields agree, `false` for the default message,
 * or the message itself.
 */
export type ConstraintVerdict = boolean | string;

/**
 * Options of `n.constraint()`.
 */
export interface ConstraintOptions<Key extends string> {
  /**
   * The field the issue belongs to, or a path to it; without one, the issue belongs to the object.
   */
  readonly path?: Key | readonly PropertyKey[];
  /**
   * The message when the check answers `false`.
   */
  readonly message?: string;
}

/**
 * Any constraint, whatever fields it lists, as adapters take it.
 */
export interface AnyConstraint {
  readonly issuesOf: (
    input: Readonly<Record<string, unknown>>,
  ) => readonly StandardSchemaV1.Issue[];
}
