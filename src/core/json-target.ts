import type { StandardJSONSchemaV1 } from './standard-spec.ts';

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

/**
 * Internal: a JSON Schema body in the keywords of OpenAPI 3.0, which has no `contentEncoding` and
 * writes base64 text as `format: 'byte'` instead.
 */
export const withOpenApiEncoding = (body: Record<string, unknown>): Record<string, unknown> => {
  if (body['contentEncoding'] === undefined) {
    return body;
  }

  const { contentEncoding, ...rest } = body;

  return contentEncoding === 'base64' && rest['format'] === undefined
    ? { ...rest, format: 'byte' }
    : rest;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nestedLists = new Set(['allOf', 'anyOf', 'oneOf']);
const nestedSchemas = new Set(['items', 'not', 'additionalProperties']);

// An exclusive bound as OpenAPI 3.0 writes it, unless the inclusive one beside it is stricter.
const openApiBound = (
  side: 'minimum' | 'maximum',
  inclusive: unknown,
  exclusive: number,
): Array<[string, unknown]> => {
  const flag = side === 'minimum' ? 'exclusiveMinimum' : 'exclusiveMaximum';
  const stricter =
    typeof inclusive === 'number' &&
    (side === 'minimum' ? inclusive > exclusive : inclusive < exclusive);

  return stricter
    ? [[side, inclusive]]
    : [
        [side, exclusive],
        [flag, true],
      ];
};

/**
 * Internal: a JSON Schema with its exclusive bounds written as OpenAPI 3.0 writes them, a
 * `minimum` or `maximum` with `exclusiveMinimum: true` or `exclusiveMaximum: true`, all the way
 * down.
 */
export const withOpenApiBounds = (body: Record<string, unknown>): Record<string, unknown> => {
  const entries = Object.entries(body).flatMap(([key, value]): Array<[string, unknown]> => {
    if (key === 'minimum' && typeof body['exclusiveMinimum'] === 'number') {
      return [];
    }

    if (key === 'maximum' && typeof body['exclusiveMaximum'] === 'number') {
      return [];
    }

    if (key === 'exclusiveMinimum' && typeof value === 'number') {
      return openApiBound('minimum', body['minimum'], value);
    }

    if (key === 'exclusiveMaximum' && typeof value === 'number') {
      return openApiBound('maximum', body['maximum'], value);
    }

    if (nestedLists.has(key) && Array.isArray(value)) {
      return [
        [key, value.map((item: unknown) => (isRecord(item) ? withOpenApiBounds(item) : item))],
      ];
    }

    if (nestedSchemas.has(key) && isRecord(value)) {
      return [[key, withOpenApiBounds(value)]];
    }

    if (key === 'properties' && isRecord(value)) {
      const fields = Object.entries(value).map(([name, field]) => [
        name,
        isRecord(field) ? withOpenApiBounds(field) : field,
      ]);

      return [[key, Object.fromEntries(fields)]];
    }

    return [[key, value]];
  });

  return Object.fromEntries(entries);
};

const forOpenApi = (body: Record<string, unknown>): Record<string, unknown> => {
  const { examples, ...rest } = withOpenApiBounds(withOpenApiEncoding(body));

  return Array.isArray(examples) && examples.length > 0 ? { ...rest, example: examples[0] } : rest;
};

/**
 * Puts the `$schema` of the requested target in front of a JSON Schema body.
 *
 * @remarks
 * OpenAPI 3.0 has no `examples` keyword on a schema, so the first one becomes its `example`, no
 * `contentEncoding`, so base64 text becomes `format: 'byte'`, and writes an exclusive bound as a
 * `minimum` or `maximum` with `exclusiveMinimum: true` or `exclusiveMaximum: true`.
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
