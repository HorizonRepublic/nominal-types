import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

import { isNominalType } from '../core/nominal.ts';
import { partsOf } from '../core/schema-parts.ts';
import type { SchemaParts } from '../core/schema-parts.ts';
import { isTypeSchema } from '../core/type-schema.ts';
import { bounded, refusedBy } from './bounded.ts';
import type { GeneratorContext } from './generator-context.ts';
import { arbitraryFromJson } from './json-arbitrary.ts';
import { callOf, ownRuleJson, propertyOf } from './properties.ts';

type ObjectParts = Extract<SchemaParts, { readonly kind: 'object' }>;

const acceptsOf =
  (schema: object) =>
  (value: unknown): boolean =>
    callOf(schema, 'accepts', value) === true;

/**
 * A schema as code, such as `n.of(nominal.Uuid).array()`, for messages.
 *
 * @internal
 */
export const describeSchema = (schema: unknown): string => {
  if (isNominalType(schema)) {
    return schema.typeName;
  }

  const parts = typeof schema === 'object' && schema !== null ? partsOf(schema) : undefined;

  switch (parts?.kind) {
    case 'type':
      return `n.of(${parts.type.typeName})`;
    case 'array':
      return `${describeSchema(parts.item)}.array()`;
    case 'optional':
    case 'nullable':
      return `${describeSchema(parts.item)}.${parts.kind}()`;
    case 'text':
      return `${describeSchema(parts.item)}.fromString()`;
    case 'object':
      return `n.object({ ${parts.fields.map(({ key }) => key).join(', ')} })`;
    case 'union':
      return `n.union('${parts.key}', { ${parts.variants.map(({ tag }) => tag).join(', ')} })`;
    case undefined:
      return 'a schema';
    default:
      return parts satisfies never;
  }
};

const textOf = (value: unknown): string | undefined =>
  typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint'
    ? String(value)
    : undefined;

/**
 * The fields of an object, the tag of a union variant set first under its key.
 *
 * @throws {@link TypeError} when nothing can be generated for one of the fields.
 *
 * @internal
 */
const objectArbitrary = (
  schema: object,
  parts: ObjectParts,
  context: GeneratorContext,
  tag?: { readonly key: string; readonly tag: string },
): Arbitrary<unknown> => {
  const model: Record<string, Arbitrary<unknown>> = {};
  const required: string[] = [];

  for (const { key, optional, field } of parts.fields) {
    if (key !== tag?.key) {
      model[key] = context.ofField(field, key);

      if (!optional) {
        required.push(key);
      }
    }
  }

  const record = fc.record(model, { requiredKeys: required, noNullPrototype: true });
  const shaped =
    tag === undefined
      ? record
      : record.map((fields) => Object.assign({ [tag.key]: tag.tag }, fields));

  return bounded(shaped, acceptsOf(schema), refusedBy(describeSchema(schema)));
};

/**
 * Inputs of a union: inputs of one of its object variants, with the variant's tag.
 *
 * @throws {@link TypeError} when a variant is not an `n.object()` schema.
 *
 * @internal
 */
const unionArbitrary = (
  schema: object,
  parts: Extract<SchemaParts, { readonly kind: 'union' }>,
  context: GeneratorContext,
): Arbitrary<unknown> => {
  const variants = parts.variants.map(({ tag, variant }) => {
    const variantParts = partsOf(variant);

    if (variantParts?.kind !== 'object') {
      throw new TypeError(`arbitraryOf(): the variant "${tag}" is not an n.object() schema`);
    }

    return objectArbitrary(variant, variantParts, context, { key: parts.key, tag });
  });

  return bounded(fc.oneof(...variants), acceptsOf(schema), refusedBy(describeSchema(schema)));
};

const plainBigInt = (_key: string, value: unknown): unknown =>
  typeof value === 'bigint' ? `${value}n` : value;

const keyOf = (value: unknown): string =>
  // @throws-ignore the replacer writes bigints as text, and generated values have no cycles
  JSON.stringify(value, plainBigInt) ?? 'undefined';

/**
 * A list of distinct items.
 *
 * @remarks
 * fast-check keeps trying forever to fill an array of distinct items from too few values, so a
 * sample tells first whether the items come in enough kinds.
 *
 * @throws {@link TypeError} when the items come in fewer kinds than the list needs.
 *
 * @internal
 */
const uniqueList = (
  item: Arbitrary<unknown>,
  counts: { readonly minLength: number; readonly maxLength?: number },
  name: string,
): Arbitrary<unknown[]> => {
  const probe = fc.sample(item, { numRuns: Math.max(200, counts.minLength * 4), seed: 1 });

  if (new Set(probe.map((value) => keyOf(value))).size < counts.minLength) {
    throw new TypeError(
      `arbitraryOf(): ${name} needs ${counts.minLength} distinct items, and its items come in fewer kinds`,
    );
  }

  return fc.uniqueArray(item, { ...counts, selector: (value) => keyOf(value) });
};

/**
 * Values of a schema from the parts its builder recorded.
 *
 * @throws {@link TypeError} when nothing can be generated for the schema or one of its fields.
 *
 * @internal
 */
const fromParts = (
  schema: object,
  parts: SchemaParts,
  context: GeneratorContext,
): Arbitrary<unknown> => {
  switch (parts.kind) {
    case 'type':
      return context.ofType(parts.type);

    case 'array': {
      const item = context.ofSchema(parts.item);
      const { length, min = length ?? 0, max = length, unique } = parts.options;
      const counts = { minLength: min, ...(max === undefined ? {} : { maxLength: max }) };
      const list =
        unique === true ? uniqueList(item, counts, describeSchema(schema)) : fc.array(item, counts);

      return bounded(list, acceptsOf(schema), refusedBy(describeSchema(schema)));
    }

    case 'optional':
      return fc.option(context.ofSchema(parts.item), { nil: undefined, freq: 4 });
    case 'nullable':
      return fc.option(context.ofSchema(parts.item), { nil: null, freq: 4 });

    case 'text': {
      const accepts = acceptsOf(schema);

      return fc.tuple(context.ofSchema(parts.item), fc.boolean()).map(([value, asText]) => {
        const text = asText ? textOf(value) : undefined;

        return text !== undefined && accepts(text) ? text : value;
      });
    }

    case 'object':
      return objectArbitrary(schema, parts, context);
    case 'union':
      return unionArbitrary(schema, parts, context);
    default:
      return parts satisfies never;
  }
};

/**
 * Values a schema built by `n.of()`, `n.object()` or `n.union()` accepts, as its input.
 *
 * @throws {@link TypeError} when no copy of this package recorded the parts of the schema.
 *
 * @internal
 */
export const schemaArbitrary = (schema: object, context: GeneratorContext): Arbitrary<unknown> => {
  const override = context.overrides.get(schema);

  if (override !== undefined) {
    return bounded(override, acceptsOf(schema), refusedBy(describeSchema(schema)));
  }

  const parts = partsOf(schema);

  if (parts === undefined) {
    throw new TypeError(
      'arbitraryOf(): the schema was not built by n.of(), n.object() or n.union() of this package',
    );
  }

  return fromParts(schema, parts, context);
};

const validates = (field: object, value: unknown): boolean => {
  const result = callOf(propertyOf(field, '~standard'), 'validate', value);

  return (
    typeof result === 'object' &&
    result !== null &&
    !(result instanceof Promise) &&
    Reflect.get(result, 'issues') === undefined
  );
};

/**
 * Values a field of an object accepts: a nominal type, a schema of this package, or a
 * Standard Schema of another library that describes itself as JSON Schema.
 *
 * @throws {@link TypeError} when nothing can be generated for the field.
 *
 * @internal
 */
export const fieldArbitrary = (
  field: unknown,
  key: string,
  context: GeneratorContext,
): Arbitrary<unknown> => {
  if (isNominalType(field)) {
    return context.ofType(field);
  }

  if (isTypeSchema(field)) {
    return context.ofSchema(field);
  }

  const source =
    (typeof field === 'object' && field !== null ? context.overrides.get(field) : undefined) ??
    arbitraryFromJson(ownRuleJson({ rule: field }));

  if (source === undefined || typeof field !== 'object' || field === null) {
    throw new TypeError(
      `arbitraryOf(): no generator makes values of the field ${key}, whose schema has no JSON Schema to generate from. Pass a generator of your own: { overrides: new Map([[schema, arbitrary]]) }`,
    );
  }

  return bounded(source, (value) => validates(field, value), refusedBy(`the field ${key}`));
};
