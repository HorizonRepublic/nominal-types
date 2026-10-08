import { withoutUri } from '../../core/json-target.ts';
import { isTarget, parseTarget } from '../../core/target.ts';
import type { NominalTarget } from '../../core/target.ts';

/**
 * Internal: the OpenAPI 3.0 schema of a nominal type or a schema, as the decorators write it.
 */
export type OpenApiSchema = Readonly<Record<string, unknown>>;

/**
 * Internal: the OpenAPI 3.0 schema of a target, after checking that a decorator was given one.
 */
export const openApiSchemaOf = (target: NominalTarget, decorator: string): OpenApiSchema => {
  if (!isTarget(target)) {
    throw new TypeError(`${decorator}() takes a nominal type or an n.of() schema`);
  }

  return withoutUri(target['~standard'].jsonSchema.input({ target: 'openapi-3.0' }));
};

/**
 * Internal: whether a value must be given, which it need not when the target accepts `undefined`,
 * as `n.of(Email).optional()` does.
 */
// oxlint-disable-next-line unicorn/no-useless-undefined
export const isRequired = (target: NominalTarget): boolean => !parseTarget(target, undefined).ok;

/**
 * Internal: a property schema with whether the property is required, in the form `@ApiProperty()`
 * takes it. An object schema keeps its own list of required fields under `required`, so whether
 * the property itself is required goes into `selfRequired`.
 */
export const propertyOf = (schema: OpenApiSchema, required: boolean): OpenApiSchema =>
  Array.isArray(schema['required'])
    ? { ...schema, selfRequired: required }
    : { ...schema, required };
