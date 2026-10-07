import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import type { StandardSchemaV1 } from '@standard-schema/spec';

import { issueText } from '../../core/issue-text.ts';
import { isNominalType } from '../../core/nominal.ts';
import { isTarget, parseTarget } from '../../core/target.ts';
import type { NominalTarget } from '../../core/target.ts';
import { textFormOf } from '../../core/text-form.ts';
import { isArraySchema } from '../../core/type-schema.ts';

/**
 * What `NominalPipe` checks a value against: a nominal type, or a schema built by `schemaOf()`.
 */
export type NominalPipeTarget = NominalTarget;

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
  /**
   * Whether a string from a query string or a route parameter is read as the value of a number or
   * boolean type, so `?page=2` becomes `2`. On by default; a `schemaOf()` schema reads text only
   * through its own `fromString()`.
   */
  readonly fromString?: boolean;
}

const badRequest: NominalExceptionFactory = (issues, metadata) =>
  new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: issues.map((issue) => issueText(issue, metadata.data)),
  });

const targetOf = (metadata: ArgumentMetadata): NominalPipeTarget | undefined => {
  const declared: unknown = Reflect.get(metadata, 'schema');

  if (isTarget(declared)) {
    return declared;
  }

  return isNominalType(metadata.metatype) ? metadata.metatype : undefined;
};

/**
 * Validates a route argument into a nominal type and hands the handler the instance.
 *
 * @remarks
 * Given a type or a `schemaOf()` schema, it checks that. Given none, it uses the parameter's
 * `{ schema }` on Nest 12 when that is a nominal type or a `schemaOf()` schema, else the type the
 * parameter is declared with, and passes every other argument through untouched; that makes it
 * safe to bind globally. Declared types lose array items and `?`, so `Uuid[]` and `email?: Email`
 * need a schema. In a query string, a lone value given to an array schema is wrapped into an
 * array, and a string for a number or boolean type is read as its value, so `?page=2` gives `2`.
 * Works on Nest 11 and 12. Pipes never run on `@Headers()`.
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
 *
 * @Get()
 * list(@Query('ids', new NominalPipe(schemaOf(Uuid).array({ max: 100 }))) ids: readonly Uuid[]) {}
 * ```
 */
export class NominalPipe implements PipeTransform<unknown, unknown> {
  readonly #target: NominalPipeTarget | undefined;
  readonly #exceptionFactory: NominalExceptionFactory;
  readonly #fromString: boolean;

  public constructor(options?: NominalPipeOptions);
  public constructor(target: NominalPipeTarget, options?: NominalPipeOptions);
  public constructor(
    targetOrOptions?: NominalPipeTarget | NominalPipeOptions,
    options: NominalPipeOptions = {},
  ) {
    const target = isTarget(targetOrOptions) ? targetOrOptions : undefined;
    const settings = isTarget(targetOrOptions) ? options : (targetOrOptions ?? options);

    this.#target = target;
    this.#exceptionFactory = settings.exceptionFactory ?? badRequest;
    this.#fromString = settings.fromString ?? true;
  }

  public transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const target = this.#target ?? targetOf(metadata);

    if (target === undefined) {
      return value;
    }

    const parsed = parseTarget(target, this.#inputOf(target, value, metadata));

    if (parsed.ok) {
      return parsed.value;
    }

    throw this.#exceptionFactory(parsed.issues, metadata);
  }

  #inputOf(target: NominalPipeTarget, value: unknown, metadata: ArgumentMetadata): unknown {
    const fromText = metadata.type === 'query' || metadata.type === 'param';

    if (fromText && this.#fromString && typeof value === 'string' && isNominalType(target)) {
      return textFormOf(target)?.(value) ?? value;
    }

    const lone =
      metadata.type === 'query' &&
      value !== undefined &&
      !Array.isArray(value) &&
      isArraySchema(target);

    return lone ? [value] : value;
  }
}
