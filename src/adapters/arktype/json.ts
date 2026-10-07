import type { StandardJSONSchemaV1 } from '@standard-schema/spec';
import type { Type } from 'arktype';

import { withoutUri } from '../../core/json-target.ts';
import { constraintsKey, registry, typeKey } from './registry.ts';

type Json = Record<string, unknown>;

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNull = (value: unknown): boolean => isJson(value) && value['type'] === 'null';

const typeSchema = (
  name: string,
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
): Json => {
  const target = registry.types.get(name);

  if (target === undefined) {
    throw new TypeError(`arkSchema: no type named ${name} was given to arkOf()`);
  }

  return withoutUri(target['~standard'].jsonSchema[side](options));
};

const toOpenApi = (schema: Json): Json => {
  const { const: constant, anyOf, ...rest } = schema;
  const converted: Json = Object.hasOwn(schema, 'const') ? { ...rest, enum: [constant] } : rest;

  if (!Array.isArray(anyOf)) {
    return converted;
  }

  const others: unknown[] = anyOf.filter((branch: unknown) => !isNull(branch));

  if (others.length === anyOf.length) {
    return { ...converted, anyOf };
  }

  const [only] = others;

  return others.length === 1 && isJson(only)
    ? { ...converted, ...only, nullable: true }
    : { ...converted, anyOf: others, nullable: true };
};

type Side = 'input' | 'output';

const replaceObject = (node: Json, side: Side, options: StandardJSONSchemaV1.Options): Json => {
  const name = node[typeKey];

  if (typeof name === 'string') {
    return typeSchema(name, side, options);
  }

  const replaced: Json = {};

  for (const [key, value] of Object.entries(node)) {
    if (key !== constraintsKey) {
      replaced[key] = replaceNodes(value, side, options);
    }
  }

  return options.target === 'openapi-3.0' ? toOpenApi(replaced) : replaced;
};

const replaceNodes = (
  node: unknown,
  side: Side,
  options: StandardJSONSchemaV1.Options,
): unknown => {
  if (Array.isArray(node)) {
    return node.map((item: unknown) => replaceNodes(item, side, options));
  }

  return isJson(node) ? replaceObject(node, side, options) : node;
};

/**
 * Internal: an ArkType schema as JSON Schema, with each `arkOf()` node replaced by its type's own
 * schema and the input side of every morph.
 *
 * @throws TypeError for a target other than `draft-2020-12`, `draft-07` or `openapi-3.0`.
 */
export const describeArk = (
  ark: Type,
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
): Json => {
  if (!['draft-2020-12', 'draft-07', 'openapi-3.0'].includes(options.target)) {
    throw new TypeError(`JSON Schema target ${options.target} is not supported`);
  }

  const schema = ark.in.toJsonSchema({
    target: options.target === 'draft-2020-12' ? 'draft-2020-12' : 'draft-07',
    fallback: { predicate: (context) => context.base, morph: (context) => context.base },
  });
  const replaced = replaceObject(Object.fromEntries(Object.entries(schema)), side, options);

  return options.target === 'openapi-3.0' ? withoutUri(replaced) : replaced;
};
