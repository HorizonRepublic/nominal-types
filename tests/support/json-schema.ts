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

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const satisfiesObject = (keyword: (name: string) => unknown, value: unknown): boolean => {
  if (keyword('type') === 'object' && !isRecord(value)) {
    return false;
  }

  if (!isRecord(value)) {
    return true;
  }

  const properties = keyword('properties');
  const declared = isRecord(properties) ? properties : {};
  const required = keyword('required');

  return (
    (!Array.isArray(required) ||
      required.every((key: unknown) => typeof key === 'string' && Object.hasOwn(value, key))) &&
    Object.entries(declared).every(
      ([key, field]) => !Object.hasOwn(value, key) || satisfiesSchema(field, value[key]),
    ) &&
    (keyword('additionalProperties') !== false ||
      Object.keys(value).every((key) => Object.hasOwn(declared, key)))
  );
};

/**
 * A JSON Schema checker for the keywords the built-in types and the object schemas emit, so tests
 * can hold a schema's runtime rule against the JSON Schema it describes itself with.
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

  if (Object.hasOwn(schema, 'const') && !sameJson(keyword('const'), value)) {
    return false;
  }

  if (!satisfiesArray(keyword, value) || !satisfiesObject(keyword, value)) {
    return false;
  }

  const variants = keyword('oneOf');

  if (
    Array.isArray(variants) &&
    variants.filter((variant: unknown) => satisfiesSchema(variant, value)).length !== 1
  ) {
    return false;
  }

  const parts = keyword('allOf');

  if (Array.isArray(parts) && !parts.every((part: unknown) => satisfiesSchema(part, value))) {
    return false;
  }

  const negated = keyword('not');

  if (negated !== undefined && satisfiesSchema(negated, value)) {
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

/**
 * Every `pattern` in a JSON Schema, at any depth.
 */
export const allPatternsIn = (schema: unknown): string[] => {
  if (Array.isArray(schema)) {
    return schema.flatMap((item: unknown) => allPatternsIn(item));
  }

  if (typeof schema !== 'object' || schema === null) {
    return [];
  }

  return Object.entries(schema).flatMap(([key, value]) =>
    key === 'pattern' && typeof value === 'string' ? [value] : allPatternsIn(value),
  );
};

/**
 * Syntax that regular expression engines without backtracking, such as RE2, refuse: lookaheads,
 * lookbehinds and backreferences.
 */
export const backtrackingSyntax = /\(\?<?[=!]|\\k<|\\[1-9]/u;
