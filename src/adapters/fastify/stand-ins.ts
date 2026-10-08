import { withoutUri } from '../../core/json-target.ts';
import { isTarget } from '../../core/target.ts';
import type { NominalTarget } from '../../core/target.ts';

/**
 * The JSON Schema dialect a route shows for a nominal schema, to Fastify and to `@fastify/swagger`.
 */
export type FastifyJsonTarget = 'draft-07' | 'draft-2020-12' | 'openapi-3.0';

type Side = 'input' | 'output';

type StandIn = (target: NominalTarget, side: Side) => object;

// Fastify rewrites a headers schema made of plain objects before compiling it, which would lose
// the nominal schema behind it; an object of another class it passes on as it is.
class JsonSchemaStandIn {}

const owners: WeakMap<object, NominalTarget> = new WeakMap();

const requestParts = ['body', 'querystring', 'query', 'params', 'headers'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const describe = (
  target: NominalTarget,
  side: Side,
  dialect: FastifyJsonTarget,
): Record<string, unknown> => {
  try {
    return withoutUri(target['~standard'].jsonSchema[side]({ target: dialect }));
  } catch {
    return {};
  }
};

/**
 * The nominal type or schema a route schema stands for, given the schema itself or the
 * JSON Schema `fastifyNominal` put in its place.
 *
 * @internal
 */
export const targetOf = (schema: unknown): NominalTarget | undefined => {
  if (isTarget(schema)) {
    return schema;
  }

  return typeof schema === 'object' && schema !== null ? owners.get(schema) : undefined;
};

const standInFor = (dialect: FastifyJsonTarget): StandIn => {
  const made = { input: new WeakMap<object, object>(), output: new WeakMap<object, object>() };

  return (target, side) => {
    const known = made[side].get(target);

    if (known !== undefined) {
      return known;
    }

    const json = Object.assign(new JsonSchemaStandIn(), describe(target, side, dialect));

    made[side].set(target, json);
    owners.set(json, target);

    return json;
  };
};

// A schema of a part, or of a response, or the same given by content type.
const replaced = (value: unknown, side: Side, standIn: StandIn): unknown => {
  if (isTarget(value)) {
    return standIn(value, side);
  }

  if (!isRecord(value) || !isRecord(value['content'])) {
    return value;
  }

  const content = Object.fromEntries(
    Object.entries(value['content']).map(([type, entry]) => [
      type,
      isRecord(entry) ? { ...entry, schema: replaced(entry['schema'], side, standIn) } : entry,
    ]),
  );

  return { ...value, content };
};

/**
 * A maker of route schemas with JSON Schemas in place of the nominal ones, so Fastify
 * and `@fastify/swagger` read JSON Schema while the compilers still find the nominal schema
 * behind each.
 *
 * @internal
 */
export const standInMaker = (
  dialect: FastifyJsonTarget,
): ((schema: object) => Record<string, unknown>) => {
  const standIn = standInFor(dialect);

  return (schema) => {
    const copy: Record<string, unknown> = { ...schema };

    for (const part of requestParts) {
      if (part in copy) {
        copy[part] = replaced(copy[part], 'input', standIn);
      }
    }

    const response: unknown = Reflect.get(schema, 'response');

    if (isRecord(response)) {
      copy['response'] = Object.fromEntries(
        Object.entries(response).map(([status, value]) => [
          status,
          replaced(value, 'output', standIn),
        ]),
      );
    }

    return copy;
  };
};
