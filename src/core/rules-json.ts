import type { StandardJSONSchemaV1 } from '@standard-schema/spec';

import type { NominalSchema } from './contracts.ts';
import { withoutUri } from './json-target.ts';

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

    return converter[side](options);
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
