import type { StandardJSONSchemaV1 } from '@standard-schema/spec';

const schemaUris: Readonly<Record<string, string | undefined>> = {
  'draft-2020-12': 'https://json-schema.org/draft/2020-12/schema',
  'draft-07': 'http://json-schema.org/draft-07/schema#',
  'openapi-3.0': undefined,
};

/**
 * How a rejected value appears in a message: a string quoted, a number, a bigint or a boolean as written,
 * anything else by its kind.
 */
export const describeValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    return Object.is(value, -0) ? '-0' : String(value);
  }
  if (typeof value === 'bigint') {
    return `${value}n`;
  }
  return typeof value === 'boolean' ? String(value) : typeof value;
};

/**
 * Puts the `$schema` of the requested target in front of a JSON Schema body.
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
  return uri === undefined ? { ...body } : { $schema: uri, ...body };
};
