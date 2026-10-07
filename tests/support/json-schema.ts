/**
 * A JSON Schema checker for the keywords the built-in types emit, so tests can hold a type's
 * runtime rule against the schema it describes itself with.
 */
export const satisfiesSchema = (schema: unknown, value: unknown): boolean => {
  if (typeof schema !== 'object' || schema === null) {
    return true;
  }

  const keyword = (name: string): unknown => Reflect.get(schema, name);
  const parts = keyword('allOf');

  if (Array.isArray(parts) && !parts.every((part: unknown) => satisfiesSchema(part, value))) {
    return false;
  }

  const type = keyword('type');

  if (type === 'string' && typeof value !== 'string') {
    return false;
  }

  if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    return false;
  }

  if (type === 'integer' && !Number.isInteger(value)) {
    return false;
  }

  if (type === 'boolean' && typeof value !== 'boolean') {
    return false;
  }

  const bounds: ReadonlyArray<readonly [string, (bound: number, number: number) => boolean]> = [
    ['minimum', (bound, number) => number >= bound],
    ['maximum', (bound, number) => number <= bound],
    ['exclusiveMinimum', (bound, number) => number > bound],
    ['exclusiveMaximum', (bound, number) => number < bound],
  ];

  for (const [name, holds] of bounds) {
    const bound = keyword(name);

    if (typeof bound === 'number' && typeof value === 'number' && !holds(bound, value)) {
      return false;
    }
  }

  const pattern = keyword('pattern');

  if (
    typeof pattern === 'string' &&
    typeof value === 'string' &&
    !new RegExp(pattern, 'u').test(value)
  ) {
    return false;
  }

  const minLength = keyword('minLength');

  if (
    typeof minLength === 'number' &&
    typeof value === 'string' &&
    Array.from(value).length < minLength
  ) {
    return false;
  }

  const maxLength = keyword('maxLength');

  return !(
    typeof maxLength === 'number' &&
    typeof value === 'string' &&
    Array.from(value).length > maxLength
  );
};
