import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { AnyNominalType } from '../../core/contracts.ts';
import { isNominalType } from '../../core/nominal.ts';

/**
 * Turns the issues of a rejected value into the exception the request fails with.
 */
export type NominalExceptionFactory = (
  issues: readonly StandardSchemaV1.Issue[],
  metadata: ArgumentMetadata,
) => Error;

/**
 * Options for `NominalPipe`.
 */
export interface NominalPipeOptions {
  readonly exceptionFactory?: NominalExceptionFactory;
}

const describeIssue = (issue: StandardSchemaV1.Issue, metadata: ArgumentMetadata): string => {
  const path = [metadata.data, ...(issue.path ?? [])]
    .filter((segment) => segment !== undefined)
    .map((segment) => String(typeof segment === 'object' ? segment.key : segment));
  return path.length === 0 ? issue.message : `${path.join('.')}: ${issue.message}`;
};

const badRequest: NominalExceptionFactory = (issues, metadata) =>
  new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: issues.map((issue) => describeIssue(issue, metadata)),
  });

/**
 * Validates a route argument into a nominal type and hands the handler the instance.
 *
 * @remarks
 * Given a type, it checks that type. Given none, it reads the type the parameter is declared with,
 * which Nest reflects from the handler signature, and passes every other argument through
 * untouched; that makes it safe to bind globally. A value that is already an instance passes
 * without a second check. Works on Nest 11 and 12. Pipes never run on `@Headers()`.
 *
 * @example
 * ```ts
 * app.useGlobalPipes(new NominalPipe());
 *
 * @Get(':id')
 * find(@Param('id') id: Uuid) {}
 *
 * @Get(':id')
 * findOne(@Param('id', new NominalPipe(Uuid)) id: Uuid) {}
 * ```
 */
export class NominalPipe implements PipeTransform<unknown, unknown> {
  readonly #type: AnyNominalType | undefined;
  readonly #exceptionFactory: NominalExceptionFactory;

  public constructor(options?: NominalPipeOptions);
  public constructor(type: AnyNominalType, options?: NominalPipeOptions);
  public constructor(
    typeOrOptions?: AnyNominalType | NominalPipeOptions,
    options: NominalPipeOptions = {},
  ) {
    const type = isNominalType(typeOrOptions) ? typeOrOptions : undefined;
    const settings = isNominalType(typeOrOptions) ? options : (typeOrOptions ?? options);
    this.#type = type;
    this.#exceptionFactory = settings.exceptionFactory ?? badRequest;
  }

  public transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const type = this.#type ?? (isNominalType(metadata.metatype) ? metadata.metatype : undefined);
    if (type === undefined) {
      return value;
    }
    const parsed = type.parse(value);
    if (parsed.ok) {
      return parsed.value;
    }
    throw this.#exceptionFactory(parsed.issues, metadata);
  }
}
