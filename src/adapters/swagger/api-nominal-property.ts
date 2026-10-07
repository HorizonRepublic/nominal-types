import { ApiProperty } from '@nestjs/swagger';
import type { ApiPropertyOptions } from '@nestjs/swagger';

import { withoutUri } from '../../core/json-target.ts';
import { isTarget, parseTarget } from '../../core/target.ts';
import type { NominalTarget } from '../../core/target.ts';

/**
 * Documents a DTO property as a nominal type, for projects that describe DTOs to `@nestjs/swagger`
 * by hand rather than through its CLI plugin.
 *
 * @remarks
 * Takes a nominal type or a `schemaOf()` schema and writes its whole OpenAPI 3.0 schema into the
 * property: pattern, format, length limits, example, and for lists `items`, `minItems` and
 * `maxItems`. The property is required unless the schema accepts `undefined`, as
 * `schemaOf(Email).optional()` does. `options` are `@ApiProperty`'s own and win over the
 * generated ones.
 *
 * @throws TypeError when `target` is neither a nominal type nor a `schemaOf()` schema.
 *
 * @example
 * ```ts
 * class CreateOrderDto {
 *   @ApiNominalProperty(Email) contact!: Email;
 *   @ApiNominalProperty(schemaOf(Uuid).array({ min: 1 })) items!: readonly Uuid[];
 * }
 * ```
 */
export const ApiNominalProperty = (
  target: NominalTarget,
  options: ApiPropertyOptions = {},
): PropertyDecorator => {
  if (!isTarget(target)) {
    throw new TypeError('ApiNominalProperty() takes a nominal type or a schemaOf() schema');
  }

  const schema = withoutUri(target['~standard'].jsonSchema.input({ target: 'openapi-3.0' }));
  // A schema that accepts a missing value describes an optional property.
  // oxlint-disable-next-line unicorn/no-useless-undefined
  const required = !parseTarget(target, undefined).ok;

  // The generated schema is plain JSON Schema, which `ApiProperty` takes keyword for keyword; its
  // option type is a union the compiler can't match against a record.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return ApiProperty({ ...schema, required, ...options } as ApiPropertyOptions);
};
