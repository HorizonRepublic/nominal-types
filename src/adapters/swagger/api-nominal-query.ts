import { ApiQuery } from '@nestjs/swagger';

import type { NominalTarget } from '../../core/target.ts';
import { isRequired, openApiSchemaOf } from './openapi-schema.ts';

/**
 * Options for {@link ApiNominalQuery}.
 */
export interface ApiNominalQueryOptions {
  /**
   * The description of the query value in the document.
   *
   * @defaultValue No description.
   */
  readonly description?: string;
  /**
   * Whether the query value must be given.
   *
   * @defaultValue `true`, unless the schema accepts `undefined`.
   */
  readonly required?: boolean;
}

/**
 * Documents a query value with its type's whole schema, for a list or a value that may be missing,
 * which `@nestjs/swagger` can't read from the parameter's declared type.
 *
 * @remarks
 * Takes a nominal type or a `n.of()` schema and writes its OpenAPI 3.0 schema into the query
 * parameter: for lists `items`, `minItems` and `maxItems`. The value is required unless the
 * schema accepts `undefined`, as `n.of(PositiveInteger).optional()` does; `required` and
 * `description` in `options` win. It replaces what `@nestjs/swagger` reflects for a parameter of
 * the same name.
 *
 * @param name - The name of the query value, as in `@Query()`.
 * @param target - The nominal type or `n.of()` schema of the value.
 * @param options - The description and whether the value is required.
 * @returns A decorator for a route.
 * @throws {@link TypeError} when `target` is neither a nominal type nor a `n.of()` schema.
 *
 * @example
 * ```ts
 * import { Controller, Get, Query } from '@nestjs/common';
 * import { n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
 * import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';
 * import { ApiNominalQuery } from '@horizon-republic/nominal-types/adapters/swagger';
 *
 * const Ids = n.of(Uuid).array({ max: 100 });
 *
 * @Controller('orders')
 * export class OrdersController {
 *   @Get()
 *   @ApiNominalQuery('ids', Ids)
 *   @ApiNominalQuery('page', PositiveInteger, { required: false })
 *   public list(
 *     @Query('ids', new NominalPipe(Ids)) ids: readonly Uuid[],
 *     @Query('page') page?: PositiveInteger,
 *   ): number {
 *     return ids.length;
 *   }
 * }
 * ```
 */
export const ApiNominalQuery = (
  name: string,
  target: NominalTarget,
  options: ApiNominalQueryOptions = {},
): MethodDecorator => {
  const schema = openApiSchemaOf(target, 'ApiNominalQuery');
  // `@nestjs/swagger` copies these options over the parameter it reflects, whose declared class or
  // `Array` would replace the schema; `String` is the one type it leaves the schema alone for.
  const query = { name, required: isRequired(target), ...options, schema, type: String };

  return ApiQuery(query);
};
