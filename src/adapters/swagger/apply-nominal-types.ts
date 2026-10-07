import { withoutUri } from '../../core/json-target.ts';
import { nominalTypeNamed } from '../../core/nominal.ts';

/**
 * The part of an OpenAPI document this adapter reads and fills.
 */
export interface OpenApiDocument {
  readonly openapi?: string;
  readonly components?: { readonly schemas?: Readonly<Record<string, unknown>> } | undefined;
}

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  (typeof value === 'object' && value !== null && Object.keys(value).length === 0);

const isEmptyObjectSchema = (schema: unknown): boolean =>
  typeof schema === 'object' &&
  schema !== null &&
  Reflect.get(schema, 'type') === 'object' &&
  isEmpty(Reflect.get(schema, 'properties')) &&
  Reflect.get(schema, 'allOf') === undefined;

const schemaFor = (name: string, schema: unknown): unknown => {
  const type = isEmptyObjectSchema(schema) ? nominalTypeNamed(name) : undefined;

  return type === undefined
    ? schema
    : withoutUri(type['~standard'].jsonSchema.input({ target: 'openapi-3.0' }));
};

/**
 * Fills the schemas `@nestjs/swagger` leaves empty for nominal types, such as the `Uuid` of
 * `@Param('id') id: Uuid`, with each type's own schema.
 *
 * @remarks
 * `@nestjs/swagger` describes a class it doesn't know as an object with no properties, named after
 * the class. Each such schema whose name is a nominal type's name is replaced with that type's
 * OpenAPI 3.0 schema, so every `$ref` to it gains the pattern, format, length limits and example.
 * Schemas with properties are left alone, and the document passed in is not changed.
 *
 * @example
 * ```ts
 * const document = applyNominalTypes(SwaggerModule.createDocument(app, config));
 * SwaggerModule.setup('docs', app, document);
 * ```
 */
export const applyNominalTypes = <Document extends OpenApiDocument>(
  document: Document,
): Document => {
  const schemas = document.components?.schemas;

  if (schemas === undefined) {
    return document;
  }

  return {
    ...document,
    components: {
      ...document.components,
      schemas: Object.fromEntries(
        Object.entries(schemas).map(([name, schema]) => [name, schemaFor(name, schema)]),
      ),
    },
  };
};
