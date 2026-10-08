type Schema = Record<string, unknown>;

const conflict = Symbol('conflict');

type Combine = (left: unknown, right: unknown) => unknown;

const same: Combine = (left, right) =>
  // @throws-ignore the values are keywords of a JSON Schema, which is JSON
  JSON.stringify(left) === JSON.stringify(right) ? left : conflict;

const larger: Combine = (left, right) =>
  typeof left === 'number' && typeof right === 'number' ? Math.max(left, right) : conflict;

const smaller: Combine = (left, right) =>
  typeof left === 'number' && typeof right === 'number' ? Math.min(left, right) : conflict;

const later: Combine = (_left, right) => right;

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);

const bothLists: Combine = (left, right) => [...listOf(left), ...listOf(right)];

const numeric = new Set(['number', 'integer']);

const typeOf: Combine = (left, right) => {
  if (left === right) {
    return left;
  }

  return typeof left === 'string' &&
    numeric.has(left) &&
    typeof right === 'string' &&
    numeric.has(right)
    ? 'integer'
    : conflict;
};

// Each number format and the wider ones it narrows down.
const widerFormats: Readonly<Record<string, readonly string[] | undefined>> = {
  float: ['double'],
  int32: ['double', 'int64'],
  int64: ['double'],
};

const formatOf: Combine = (left, right) => {
  if (left === right) {
    return left;
  }

  if (typeof left !== 'string' || typeof right !== 'string') {
    return conflict;
  }

  if (widerFormats[left]?.includes(right) === true) {
    return left;
  }

  return widerFormats[right]?.includes(left) === true ? right : conflict;
};

// Keywords that each restrict the value on their own, so two schemas holding them can be written
// as one; a schema with any other keyword, such as `properties` or `nullable`, whose meaning
// depends on its neighbours, stays an entry of its own.
const combiners: Readonly<Record<string, Combine | undefined>> = {
  type: typeOf,
  format: formatOf,
  pattern: same,
  enum: same,
  const: same,
  anyOf: same,
  not: same,
  multipleOf: same,
  contentEncoding: same,
  contentMediaType: same,
  minimum: larger,
  exclusiveMinimum: larger,
  minLength: larger,
  maximum: smaller,
  exclusiveMaximum: smaller,
  maxLength: smaller,
  title: later,
  description: later,
  examples: bothLists,
};

const isFlat = (schema: Schema): boolean =>
  Object.keys(schema).every((key) => combiners[key] !== undefined);

const withExamples = (schema: Schema): Schema => {
  if (schema['example'] === undefined) {
    return schema;
  }

  const { example, examples, ...rest } = schema;

  return { ...rest, examples: [...listOf(examples ?? []), example] };
};

const isRecord = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// The `anyOf` of `schema` says nothing more once `other` holds every keyword of one of its
// branches with the same value, as `Ipv4Address` does for the IPv4 branch of `IpAddress`.
const withoutImpliedChoice = (schema: Schema, other: Schema): Schema => {
  const { anyOf, ...rest } = schema;
  const implied =
    Array.isArray(anyOf) &&
    anyOf.some(
      (branch: unknown) =>
        isRecord(branch) &&
        Object.entries(branch).every(
          ([key, value]) => Object.hasOwn(other, key) && same(other[key], value) !== conflict,
        ),
    );

  return implied ? rest : schema;
};

const merged = (left: Schema, right: Schema): Schema | undefined => {
  const result = withoutImpliedChoice(left, right);

  for (const [key, value] of Object.entries(withoutImpliedChoice(right, left))) {
    const combine = combiners[key];

    if (combine === undefined) {
      return undefined;
    }

    const combined = Object.hasOwn(result, key) ? combine(result[key], value) : value;

    if (combined === conflict) {
      return undefined;
    }

    result[key] = combined;
  }

  return result;
};

// Of an inclusive and an exclusive bound on the same side, only the stricter one says anything.
const strictestBounds = (schema: Schema): Schema => {
  const { minimum, exclusiveMinimum, maximum, exclusiveMaximum, ...rest } = schema;
  const lower =
    typeof minimum === 'number' && typeof exclusiveMinimum === 'number'
      ? exclusiveMinimum >= minimum
        ? { exclusiveMinimum }
        : { minimum }
      : { minimum, exclusiveMinimum };
  const upper =
    typeof maximum === 'number' && typeof exclusiveMaximum === 'number'
      ? exclusiveMaximum <= maximum
        ? { exclusiveMaximum }
        : { maximum }
      : { maximum, exclusiveMaximum };

  return Object.fromEntries(
    Object.entries({ ...rest, ...lower, ...upper }).filter(([, value]) => value !== undefined),
  );
};

const tidied = (schema: Schema): Schema => {
  const { type, format, title, description, examples, ...rest } = strictestBounds(schema);
  const keptFormat = type === 'integer' && format === 'double' ? undefined : format;

  return Object.fromEntries(
    Object.entries({ type, format: keptFormat, ...rest, title, description, examples }).filter(
      ([, value]) => value !== undefined,
    ),
  );
};

/**
 * The JSON Schemas of a type's rules, from the root down, as one schema where they fit
 * together, or an `allOf` of the parts that don't.
 *
 * @remarks
 * Each rule is merged into the one before it when every keyword of both restricts the value on
 * its own and no keyword says two different things: `number` and `integer` make `integer`, bounds
 * keep the strictest, a number format keeps the narrowest, and the description of the rule further
 * down wins. Two different patterns, or anything else that differs, start a new entry.
 *
 * @internal
 */
export const flattened = (parts: readonly Schema[]): Schema => {
  const groups: Array<{ readonly schema: Schema; readonly joined: boolean }> = [];

  for (const part of parts) {
    const last = groups.at(-1);
    const candidate = withExamples(part);
    const joined =
      last !== undefined && isFlat(last.schema) && isFlat(candidate)
        ? merged(last.schema, candidate)
        : undefined;

    if (joined === undefined) {
      groups.push({ schema: isFlat(candidate) ? candidate : part, joined: false });
    } else {
      groups[groups.length - 1] = { schema: joined, joined: true };
    }
  }

  const schemas = groups.map((group) => (group.joined ? tidied(group.schema) : group.schema));
  const [only] = schemas;

  return schemas.length === 1 && only !== undefined ? only : { allOf: schemas };
};
