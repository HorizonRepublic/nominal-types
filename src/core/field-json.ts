import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Internal: the JSON Schema of a field of an object, without its `$schema`.
 *
 * @throws TypeError naming `owner` for a field schema that can't describe itself.
 */
export const describeField = (
  field: StandardSchemaV1,
  side: 'input' | 'output',
  target: StandardJSONSchemaV1.Options,
  owner: string,
): Record<string, unknown> => {
  const converter: unknown = Reflect.get(field['~standard'], 'jsonSchema');
  const describe: unknown =
    typeof converter === 'object' && converter !== null ? Reflect.get(converter, side) : undefined;
  const schema: unknown =
    typeof describe === 'function' ? Reflect.apply(describe, converter, [target]) : undefined;

  if (!isRecord(schema)) {
    throw new TypeError(`a field of the ${owner} cannot describe itself as JSON Schema`);
  }

  return Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$schema'));
};
