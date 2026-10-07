import type { StandardJSONSchemaV1 } from '@standard-schema/spec';

const collect = (
  body: Record<string, unknown>,
): { readonly schema: Record<string, unknown>; readonly examples: readonly unknown[] } => {
  const { examples, example, allOf, ...schema } = body;
  const own: unknown[] = [
    ...(Array.isArray(examples) ? (examples as unknown[]) : []),
    ...(example === undefined ? [] : [example]),
  ];

  if (!Array.isArray(allOf)) {
    return { schema, examples: own };
  }

  const parts = allOf.map((part: unknown) =>
    typeof part === 'object' && part !== null
      ? collect(Object.fromEntries(Object.entries(part)))
      : { schema: {}, examples: [] },
  );

  return {
    schema: { ...schema, allOf: parts.map((part) => part.schema) },
    examples: [...own, ...parts.flatMap((part) => part.examples)],
  };
};

/**
 * Internal: a type's JSON Schema with the examples of all its rules moved to the top, keeping only
 * those the whole type accepts.
 *
 * @remarks
 * A subtype's `allOf` carries its parent's examples, which its own rule may reject. Checking each
 * example against the type itself means a schema never shows a value the type refuses. OpenAPI
 * 3.0 gets the first one as `example`.
 */
export const withValidExamples = (
  body: Record<string, unknown>,
  options: StandardJSONSchemaV1.Options,
  accepts: (example: unknown) => boolean,
): Record<string, unknown> => {
  const { schema, examples } = collect(body);
  const valid = [...new Set(examples)].filter((example) => accepts(example));
  const [first] = valid;

  if (first === undefined) {
    return schema;
  }

  return options.target === 'openapi-3.0'
    ? { ...schema, example: first }
    : { ...schema, examples: valid };
};
