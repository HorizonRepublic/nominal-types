import type { StandardJSONSchemaV1 } from '@standard-schema/spec';

const schemaUris: Readonly<Record<string, string | undefined>> = {
  'draft-2020-12': 'https://json-schema.org/draft/2020-12/schema',
  'draft-07': 'http://json-schema.org/draft-07/schema#',
  'openapi-3.0': undefined,
};

/**
 * A JSON Schema body without its `$schema`, for nesting it inside another schema.
 */
export const withoutUri = (schema: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$schema'));

const forOpenApi = (body: Record<string, unknown>): Record<string, unknown> => {
  const { examples, ...rest } = body;

  return Array.isArray(examples) && examples.length > 0 ? { ...rest, example: examples[0] } : rest;
};

/**
 * Puts the `$schema` of the requested target in front of a JSON Schema body.
 *
 * @remarks
 * OpenAPI 3.0 has no `examples` keyword on a schema, so the first one becomes its `example`.
 *
 * @throws TypeError for a target other than `draft-2020-12`, `draft-07` or `openapi-3.0`.
 */
export const forTarget = (
  options: StandardJSONSchemaV1.Options,
  body: Record<string, unknown>,
): Record<string, unknown> => {
  if (!Object.hasOwn(schemaUris, options.target)) {
    throw new TypeError(`JSON Schema target ${options.target} is not supported`);
  }

  const uri = schemaUris[options.target];

  if (uri === undefined) {
    return forOpenApi(body);
  }

  return { $schema: uri, ...body };
};
