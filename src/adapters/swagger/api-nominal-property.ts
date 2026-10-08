import { ApiProperty } from '@nestjs/swagger';
import type { ApiPropertyOptions } from '@nestjs/swagger';

import type { NominalTarget } from '../../core/target.ts';
import { fieldOf, isRequired, openApiSchemaOf, propertyOf } from './openapi-schema.ts';

/**
 * Documents a DTO property as a nominal type, for projects that describe DTOs to `@nestjs/swagger`
 * by hand rather than through its CLI plugin.
 *
 * @remarks
 * Takes a nominal type or a `n.of()` schema and writes its whole OpenAPI 3.0 schema into the
 * property: pattern, format, length limits, example, and for lists `items`, `minItems` and
 * `maxItems`. The property is required unless the schema accepts `undefined`, as
 * `n.of(Email).optional()` does. `options` are `@ApiProperty`'s own and win over the
 * generated ones.
 *
 * @throws TypeError when `target` is neither a nominal type nor a `n.of()` schema.
 *
 * @example
 * ```ts
 * class CreateOrderDto {
 *   @ApiNominalProperty(Email) contact!: Email;
 *   @ApiNominalProperty(n.of(Uuid).array({ min: 1 })) items!: readonly Uuid[];
 * }
 * ```
 */
export const ApiNominalProperty = (
  target: NominalTarget,
  options: ApiPropertyOptions = {},
): PropertyDecorator => {
  const schema = openApiSchemaOf(target, 'ApiNominalProperty');

  return ApiProperty({ ...propertyOf(fieldOf(schema), isRequired(target)), ...options });
};
