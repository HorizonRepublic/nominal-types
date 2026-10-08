import { ApiBody, ApiProperty } from '@nestjs/swagger';

import type { NominalTarget } from '../../core/target.ts';
import { isRequired, openApiSchemaOf, propertyOf } from './openapi-schema.ts';
import type { OpenApiSchema } from './openapi-schema.ts';

/**
 * Options for `@ApiNominalBody()`.
 */
export interface ApiNominalBodyOptions {
  /**
   * The name the body's schema gets under `components.schemas`, so the document refers to it with
   * a `$ref` and lists it once. Taken only by an object schema, such as one from `n.object()`;
   * without a name, the schema is written into the request body.
   */
  readonly name?: string;
  readonly description?: string;
  readonly required?: boolean;
}

const isRecord = (value: unknown): value is OpenApiSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Component = new () => object;

const combinators = ['allOf', 'anyOf', 'oneOf'];

// A field schema without `type`, such as the `allOf` of a number type, would send
// `@nestjs/swagger` looking for the property's class. Given `Array` and a combinator, it writes
// the schema as it is and drops the `type`.
const fieldOf = (schema: OpenApiSchema): Readonly<Record<string, unknown>> => {
  if (schema['type'] !== undefined) {
    return schema;
  }

  return combinators.some((key) => key in schema)
    ? { ...schema, type: Array }
    : { allOf: [schema], type: Array };
};

const components = new WeakMap<NominalTarget, Map<string, Component>>();

// `@nestjs/swagger` lists a class under `components.schemas`, never a schema object, so the
// component is a class named after it with one property per field.
const componentFor = (
  target: NominalTarget,
  name: string,
  fields: OpenApiSchema,
  required: readonly unknown[],
): Component => {
  const byName = components.get(target) ?? new Map<string, Component>();
  const known = byName.get(name);

  if (known !== undefined) {
    return known;
  }

  const component = class {};
  const schemas = Object.entries(fields).filter((entry): entry is [string, OpenApiSchema] =>
    isRecord(entry[1]),
  );

  Object.defineProperty(component, 'name', { value: name });

  for (const [key, field] of schemas) {
    ApiProperty(propertyOf(fieldOf(field), required.includes(key)))(component.prototype, key);
  }

  byName.set(name, component);
  components.set(target, byName);

  return component;
};

// Only a plain object schema becomes a component; one with more keywords, such as `nullable`,
// is written inline.
const fieldsOf = (schema: OpenApiSchema): OpenApiSchema | undefined => {
  const fields = schema['properties'];
  const plain = Object.keys(schema).every((key) =>
    ['type', 'properties', 'required'].includes(key),
  );

  return schema['type'] === 'object' && plain && isRecord(fields) ? fields : undefined;
};

/**
 * Documents the request body of a route whose `@Body()` is checked by `NominalPipe`, which
 * `@nestjs/swagger` can't see through.
 *
 * @remarks
 * Takes a nominal type or a schema, such as one from `n.object()` or `n.of()`, and writes its
 * OpenAPI 3.0 schema into the request body. With `name`, an object schema is listed under
 * `components.schemas` with that name and the body refers to it. The body is required unless
 * the schema accepts `undefined`; `required` and `description` in `options` win.
 *
 * @throws TypeError when `target` is neither a nominal type nor a `n.of()` or `n.object()`
 * schema.
 *
 * @example
 * ```ts
 * const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });
 *
 * @Post()
 * @ApiNominalBody(CreateOrder, { name: 'CreateOrder' })
 * create(@Body(new NominalPipe(CreateOrder)) order: CreateOrderBody) {}
 * ```
 */
export const ApiNominalBody = (
  target: NominalTarget,
  options: ApiNominalBodyOptions = {},
): MethodDecorator => {
  const schema = openApiSchemaOf(target, 'ApiNominalBody');
  const { name, ...rest } = options;
  const required = rest.required ?? isRequired(target);
  const fields = fieldsOf(schema);
  const requiredFields: unknown[] = Array.isArray(schema['required']) ? schema['required'] : [];
  const body =
    name !== undefined && fields !== undefined
      ? { ...rest, required, type: componentFor(target, name, fields, requiredFields) }
      : { ...rest, required, schema };

  return ApiBody(body);
};
