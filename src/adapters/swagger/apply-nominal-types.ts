import type { AnyNominalType } from '../../core/contracts.ts';
import { withoutUri } from '../../core/json-target.ts';
import { isNominalType } from '../../core/nominal.ts';
import { typeForSchemaName, typeNamed } from '../../core/registry.ts';

/**
 * The part of an OpenAPI document this adapter reads and fills.
 */
export interface OpenApiDocument {
  /**
   * The OpenAPI version the document follows, such as `3.0.0`.
   */
  readonly openapi?: string;
  /**
   * The reusable parts of the document, whose `schemas` this adapter fills.
   */
  readonly components?: { readonly schemas?: Readonly<Record<string, unknown>> } | undefined;
}

const nominalTypeNamed = (
  name: string,
  claimed: ReadonlySet<string>,
): AnyNominalType | undefined => {
  const type = typeForSchemaName(name, claimed);

  return isNominalType(type) ? type : undefined;
};

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  (typeof value === 'object' && value !== null && Object.keys(value).length === 0);

const isEmptyObjectSchema = (schema: unknown): boolean =>
  typeof schema === 'object' &&
  schema !== null &&
  Reflect.get(schema, 'type') === 'object' &&
  isEmpty(Reflect.get(schema, 'properties')) &&
  Reflect.get(schema, 'allOf') === undefined;

const schemaFor = (name: string, schema: unknown, claimed: ReadonlySet<string>): unknown => {
  const type = isEmptyObjectSchema(schema) ? nominalTypeNamed(name, claimed) : undefined;

  return type === undefined
    ? schema
    : withoutUri(type['~standard'].jsonSchema.input({ target: 'openapi-3.0' }));
};

type Node = Readonly<Record<string, unknown>>;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const referencePrefix = '#/components/schemas/';

// The type every value of a schema has: its own, the one the `allOf` parts that state a type agree
// on, or the one all `anyOf` or `oneOf` parts share.
const typeOf = (schema: unknown, schemas: Node, depth = 0): unknown => {
  if (!isNode(schema) || depth > 16) {
    return undefined;
  }

  if (typeof schema['type'] === 'string') {
    return schema['type'];
  }

  const reference = schema['$ref'];

  if (typeof reference === 'string' && reference.startsWith(referencePrefix)) {
    return typeOf(schemas[reference.slice(referencePrefix.length)], schemas, depth + 1);
  }

  const agreed = (parts: unknown, all: boolean): unknown => {
    if (!Array.isArray(parts)) {
      return undefined;
    }

    const types = parts.map((part) => typeOf(part, schemas, depth + 1));
    const stated = new Set(types.filter((type) => type !== undefined));
    const [only] = stated;

    return stated.size === 1 && (!all || !types.includes(undefined)) ? only : undefined;
  };

  return agreed(schema['allOf'], false) ?? agreed(schema['anyOf'] ?? schema['oneOf'], true);
};

const isNominalSchema = (node: Node): boolean =>
  typeof node['title'] === 'string' && isNominalType(typeNamed(node['title']));

// `@nestjs/swagger` drops the `type` next to a combinator, and a nominal type's schema made of
// parts states it only in the parts; code generators read the type from the top.
const withTypes = (value: unknown, schemas: Node): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => withTypes(item, schemas));
  }

  if (!isNode(value)) {
    return value;
  }

  const node = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, withTypes(child, schemas)]),
  );
  const type =
    node['type'] === undefined && isNominalSchema(node) ? typeOf(node, schemas) : undefined;

  return type === undefined ? node : { ...node, type };
};

/**
 * Fills the schemas `@nestjs/swagger` leaves empty for nominal types, such as the `Uuid` of
 * `@Param('id') id: Uuid`, with each type's own schema.
 *
 * @remarks
 * `@nestjs/swagger` describes a class it doesn't know as an object with no properties, named after
 * the class. Each such schema whose name is a nominal type's name is replaced with that type's
 * OpenAPI 3.0 schema, so every `$ref` to it gains the pattern, format, length limits and example.
 * Schemas with properties are left alone, and the document passed in is not changed. A nominal
 * type's schema made of `allOf` parts, such as `UuidV4`'s, gets back the top-level `type`
 * `@nestjs/swagger` drops, wherever it appears in the document.
 *
 * @typeParam Document - The type of the document, kept in the result.
 * @param document - The document `SwaggerModule.createDocument()` made.
 * @returns A copy of the document with the nominal types' schemas filled in.
 *
 * @example
 * ```ts
 * import { Module } from '@nestjs/common';
 * import { NestFactory } from '@nestjs/core';
 * import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
 * import { applyNominalTypes } from '@horizon-republic/nominal-types/adapters/swagger';
 *
 * @Module({})
 * class AppModule {}
 *
 * const app = await NestFactory.create(AppModule);
 * const config = new DocumentBuilder().setTitle('Orders').build();
 * const document = applyNominalTypes(SwaggerModule.createDocument(app, config));
 *
 * SwaggerModule.setup('docs', app, document);
 * ```
 */
export const applyNominalTypes = <Document extends OpenApiDocument>(
  document: Document,
): Document => {
  const schemas = document.components?.schemas;
  const claimed = new Set(Object.keys(schemas ?? {}));
  const filled: Node = Object.fromEntries(
    Object.entries(schemas ?? {}).map(([name, schema]) => [name, schemaFor(name, schema, claimed)]),
  );
  const typed = Object.fromEntries(
    Object.entries(document).map(([key, value]) => [key, withTypes(value, filled)]),
  );

  return schemas === undefined
    ? { ...document, ...typed }
    : {
        ...document,
        ...typed,
        components: { ...document.components, schemas: withTypes(filled, filled) },
      };
};
