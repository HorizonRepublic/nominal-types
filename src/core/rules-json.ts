import type { StandardJSONSchemaV1 } from '@standard-schema/spec';

import type { NominalSchema } from './contracts.ts';
import { withoutUri } from './json-target.ts';
import { NativeSchema } from './native-schema.ts';
import { NoJsonSchema } from './no-json-schema.ts';

// A rule of this package that has no JSON Schema throws without knowing the type it belongs to.
const describedBy = (
  typeName: string,
  describe: () => Record<string, unknown>,
): Record<string, unknown> => {
  try {
    return describe();
  } catch (error) {
    if (error instanceof NoJsonSchema) {
      throw new TypeError(`${typeName}: ${error.message}`, { cause: error });
    }

    throw error;
  }
};

/**
 * Internal: the JSON Schema of a type's rules: the rule's own schema when there is one, an `allOf`
 * of all of them, from the root down, when there are several.
 *
 * @throws TypeError naming the type when a rule can't describe itself.
 */
export const describeRules = (
  typeName: string,
  rules: readonly NominalSchema[],
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
): Record<string, unknown> => {
  const parts = rules.map((rule) => {
    const converter = rule['~standard'].jsonSchema;

    if (converter === undefined) {
      throw new TypeError(`${typeName}: the schema cannot describe itself as JSON Schema`);
    }

    if (options.target !== 'openapi-3.0') {
      return describedBy(typeName, () => converter[side](options));
    }

    // Rules of this package keep all their examples here, so the type picks its one OpenAPI
    // example from those it accepts; a rule that knows no OpenAPI 3.0 is described as draft-07,
    // which OpenAPI 3.0 schemas are built on.
    const target = rule instanceof NativeSchema ? 'draft-2020-12' : undefined;

    return withoutUri(
      describedBy(typeName, () => {
        try {
          return converter[side]({ ...options, target: target ?? options.target });
        } catch (error) {
          if (target !== undefined) {
            throw error;
          }

          return converter[side]({ ...options, target: 'draft-07' });
        }
      }),
    );
  });
  const [only] = parts;

  if (parts.length === 1 && only !== undefined) {
    return only;
  }

  const uri = parts.find((part) => part['$schema'] !== undefined)?.['$schema'];

  return {
    ...(uri === undefined ? {} : { $schema: uri }),
    allOf: parts.map((part) => withoutUri(part)),
  };
};
