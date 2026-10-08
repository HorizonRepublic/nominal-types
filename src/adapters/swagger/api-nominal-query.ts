import { ApiQuery } from '@nestjs/swagger';

import type { NominalTarget } from '../../core/target.ts';
import { isRequired, openApiSchemaOf } from './openapi-schema.ts';

/**
 * Options for `@ApiNominalQuery()`.
 */
export interface ApiNominalQueryOptions {
  readonly description?: string;
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
 * @throws TypeError when `target` is neither a nominal type nor a `n.of()` schema.
 *
 * @example
 * ```ts
 * @Get()
 * @ApiNominalQuery('ids', n.of(Uuid).array({ max: 100 }))
 * @ApiNominalQuery('page', PositiveInteger, { required: false })
 * list(
 *   @Query('ids', new NominalPipe(n.of(Uuid).array({ max: 100 }))) ids: readonly Uuid[],
 *   @Query('page') page?: PositiveInteger,
 * ) {}
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
