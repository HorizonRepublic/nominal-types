import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

/**
 * The `~standard` property every nominal type carries, which makes it a Standard Schema and a
 * Standard JSON Schema at once.
 *
 * @remarks
 * `validate` never returns a Promise, so consumers that require a synchronous result accept every
 * nominal type.
 */
export interface StandardProps<Input, Output>
  extends
    Omit<StandardSchemaV1.Props<Input, Output>, 'validate'>,
    StandardJSONSchemaV1.Props<Input, Output> {
  readonly validate: (
    value: unknown,
    options?: StandardSchemaV1.Options,
  ) => StandardSchemaV1.Result<Output>;
}

/**
 * A plain object that is a Standard Schema, for libraries that accept schema objects but not
 * classes.
 */
export interface StandardSchema<Input, Output> {
  readonly '~standard': StandardProps<Input, Output>;
}
