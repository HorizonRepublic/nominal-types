import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

type Json = Readonly<Record<string, unknown>>;

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const numberAt = (schema: Json, key: string): number | undefined => {
  const value = schema[key];

  return typeof value === 'number' ? value : undefined;
};

/**
 * Internal: the strings a pattern matches, or `undefined` for syntax fast-check can't generate
 * from, such as a lookahead.
 */
export const matchingPattern = (
  pattern: RegExp | string,
  maxLength?: number,
): Arbitrary<string> | undefined => {
  try {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'u') : pattern;

    return fc.stringMatching(regex, maxLength === undefined ? {} : { maxLength });
  } catch {
    return undefined;
  }
};

const formats: Readonly<Record<string, () => Arbitrary<string>>> = {
  email: () => fc.emailAddress(),
  uuid: () => fc.uuid(),
  uri: () => fc.webUrl(),
  ipv4: () => fc.ipV4(),
  ipv6: () => fc.ipV6(),
  hostname: () => fc.domain(),
  date: () => fc.date({ noInvalidDate: true }).map((date) => date.toISOString().slice(0, 10)),
  'date-time': () => fc.date({ noInvalidDate: true }).map((date) => date.toISOString()),
};

const stringFrom = (schema: Json): Arbitrary<unknown> | undefined => {
  const minLength = numberAt(schema, 'minLength') ?? 0;
  const maxLength = numberAt(schema, 'maxLength');

  if (typeof schema['pattern'] === 'string') {
    return matchingPattern(schema['pattern'], maxLength);
  }

  const format = typeof schema['format'] === 'string' ? formats[schema['format']] : undefined;

  return format === undefined
    ? fc.string({ minLength, ...(maxLength === undefined ? {} : { maxLength }) })
    : format();
};

const numberFrom = (schema: Json, integer: boolean): Arbitrary<unknown> => {
  const exclusiveMin = numberAt(schema, 'exclusiveMinimum');
  const exclusiveMax = numberAt(schema, 'exclusiveMaximum');
  const min = numberAt(schema, 'minimum') ?? exclusiveMin;
  const max = numberAt(schema, 'maximum') ?? exclusiveMax;
  const step = numberAt(schema, 'multipleOf');

  if (integer || step !== undefined) {
    const unit = step ?? 1;
    const lowest = min === undefined ? Number.MIN_SAFE_INTEGER : Math.ceil(min / unit);
    const highest = max === undefined ? Number.MAX_SAFE_INTEGER : Math.floor(max / unit);

    return fc
      .integer({
        min: Math.max(lowest, Number.MIN_SAFE_INTEGER),
        max: Math.min(highest, Number.MAX_SAFE_INTEGER),
      })
      .map((count) => count * unit);
  }

  return fc.double({
    noNaN: true,
    noDefaultInfinity: true,
    ...(min === undefined ? {} : { min, minExcluded: min === exclusiveMin }),
    ...(max === undefined ? {} : { max, maxExcluded: max === exclusiveMax }),
  });
};

const listFrom = (schema: Json): Arbitrary<unknown> | undefined => {
  const items = arbitraryFromJson(schema['items'] ?? {});
  const minLength = numberAt(schema, 'minItems') ?? 0;
  const maxLength = numberAt(schema, 'maxItems');

  return items === undefined
    ? undefined
    : fc.array(items, { minLength, ...(maxLength === undefined ? {} : { maxLength }) });
};

const recordFrom = (schema: Json): Arbitrary<unknown> | undefined => {
  const properties = isJson(schema['properties']) ? schema['properties'] : {};
  const required = Array.isArray(schema['required']) ? schema['required'] : [];
  const model: Record<string, Arbitrary<unknown>> = {};

  for (const [key, field] of Object.entries(properties)) {
    const arbitrary = arbitraryFromJson(field);

    if (arbitrary === undefined) {
      return undefined;
    }

    model[key] = arbitrary;
  }

  return fc.record(model, {
    requiredKeys: Object.keys(model).filter((key) => required.includes(key)),
    noNullPrototype: true,
  });
};

const choiceFrom = (schema: Json, choices: readonly unknown[]): Arbitrary<unknown> | undefined => {
  const { anyOf: _anyOf, oneOf: _oneOf, ...rest } = schema;
  const arbitraries = choices.map((choice) =>
    arbitraryFromJson(isJson(choice) ? { ...rest, ...choice } : rest),
  );

  return arbitraries.every((arbitrary) => arbitrary !== undefined)
    ? fc.oneof(...arbitraries)
    : undefined;
};

/**
 * Internal: values close to what a JSON Schema describes, for a rule that says no more about
 * itself, or `undefined` when the schema gives too little to go on; the caller filters them by
 * the rule itself.
 */
export const arbitraryFromJson = (schema: unknown): Arbitrary<unknown> | undefined => {
  if (!isJson(schema)) {
    return undefined;
  }

  if (Object.hasOwn(schema, 'const')) {
    return fc.constant(schema['const']);
  }

  const listed = schema['enum'];

  if (Array.isArray(listed) && listed.length > 0) {
    return fc.constantFrom(...(listed as unknown[]));
  }

  const choices = schema['anyOf'] ?? schema['oneOf'];

  if (Array.isArray(choices) && choices.length > 0) {
    return choiceFrom(schema, choices);
  }

  if (Array.isArray(schema['allOf'])) {
    const { allOf, ...rest } = schema;

    return arbitraryFromJson(Object.assign({}, ...allOf.filter((part) => isJson(part)), rest));
  }

  switch (schema['type']) {
    case 'string':
      return stringFrom(schema);
    case 'number':
    case 'integer':
      return numberFrom(schema, schema['type'] === 'integer');
    case 'boolean':
      return fc.boolean();
    case 'null':
      return fc.constant(null);
    case 'array':
      return listFrom(schema);
    case 'object':
      return recordFrom(schema);
    default:
      return undefined;
  }
};
