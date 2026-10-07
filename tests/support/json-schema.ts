import type { AnyNominalType } from '../../src/index.ts';

const sameJson = (left: unknown, right: unknown): boolean => {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item: unknown, index) => sameJson(item, right[index]))
    );
  }

  if (typeof left === 'object' && left !== null && typeof right === 'object' && right !== null) {
    const keys = Object.keys(left);

    return (
      keys.length === Object.keys(right).length &&
      keys.every(
        (key) =>
          Object.hasOwn(right, key) && sameJson(Reflect.get(left, key), Reflect.get(right, key)),
      )
    );
  }

  // JSON numbers are compared by value, so 0 and -0 are one number.
  return left === right;
};

const satisfiesArray = (keyword: (name: string) => unknown, value: unknown): boolean => {
  if (keyword('type') === 'array' && !Array.isArray(value)) {
    return false;
  }

  if (!Array.isArray(value)) {
    return true;
  }

  const items = keyword('items');
  const minItems = keyword('minItems');
  const maxItems = keyword('maxItems');

  return (
    value.every((item: unknown) => satisfiesSchema(items, item)) &&
    (typeof minItems !== 'number' || value.length >= minItems) &&
    (typeof maxItems !== 'number' || value.length <= maxItems) &&
    (keyword('uniqueItems') !== true ||
      value.every((item: unknown, index) =>
        value.slice(0, index).every((earlier: unknown) => !sameJson(earlier, item)),
      ))
  );
};

/**
 * A JSON Schema checker for the keywords the built-in types emit, so tests can hold a type's
 * runtime rule against the schema it describes itself with.
 */
export const satisfiesSchema = (schema: unknown, value: unknown): boolean => {
  if (typeof schema !== 'object' || schema === null) {
    return true;
  }

  const keyword = (name: string): unknown => Reflect.get(schema, name);
  const listed = keyword('enum');

  if (Array.isArray(listed) && !listed.some((item: unknown) => sameJson(item, value))) {
    return false;
  }

  if (!satisfiesArray(keyword, value)) {
    return false;
  }

  const parts = keyword('allOf');

  if (Array.isArray(parts) && !parts.every((part: unknown) => satisfiesSchema(part, value))) {
    return false;
  }

  const choices = keyword('anyOf');

  if (
    Array.isArray(choices) &&
    !choices.some((choice: unknown) => satisfiesSchema(choice, value))
  ) {
    return false;
  }

  const allowed = keyword('enum');

  if (Array.isArray(allowed) && !allowed.includes(value)) {
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

/**
 * The texts on which a type and the JSON Schema it describes itself with give different answers.
 */
export const disagreementsOf = (type: AnyNominalType, texts: readonly string[]): string[] => {
  const schema = type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

  return texts.filter((text) => satisfiesSchema(schema, text) !== type.parse(text).ok);
};
