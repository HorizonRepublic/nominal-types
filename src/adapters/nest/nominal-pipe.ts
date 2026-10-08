import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';

import type { Parsed } from '../../core/contracts.ts';
import { hideValues } from '../../core/hidden-values.ts';
import { issueText } from '../../core/issue-text.ts';
import { isNominalType } from '../../core/nominal.ts';
import type { StandardSchemaV1 } from '../../core/standard-spec.ts';
import { isTarget, parseTarget } from '../../core/target.ts';
import type { NominalTarget } from '../../core/target.ts';
import { textFormOf } from '../../core/text-form.ts';
import { isArraySchema } from '../../core/type-schema.ts';

/**
 * What {@link NominalPipe} checks a value against: a nominal type, a schema built by `n.of()` or
 * `n.object()`, or any synchronous Standard Schema, such as one from `fromArk()` or Zod.
 */
export type NominalPipeTarget = NominalTarget | StandardSchemaV1;

const isStandardSchema = (value: unknown): value is StandardSchemaV1 =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(Reflect.get(value, '~standard') ?? {}, 'validate') === 'function';

const isPipeTarget = (value: unknown): value is NominalPipeTarget =>
  isTarget(value) || isStandardSchema(value);

const parseAny = (target: NominalPipeTarget, input: unknown): Parsed<unknown> => {
  if (isTarget(target)) {
    return parseTarget(target, input);
  }

  const result = target['~standard'].validate(input);

  if (result instanceof Promise) {
    throw new TypeError('NominalPipe: asynchronous schemas are not supported');
  }

  return result.issues === undefined
    ? { ok: true, value: result.value }
    : { ok: false, issues: result.issues };
};

/**
 * Turns the issues of a rejected value into the exception the request fails with.
 *
 * @param issues - What the value was rejected for.
 * @param metadata - The route argument the value came from, such as its type and name.
 * @returns The error the pipe throws.
 */
export type NominalExceptionFactory = (
  issues: readonly StandardSchemaV1.Issue[],
  metadata: ArgumentMetadata,
) => Error;

/**
 * Options for {@link NominalPipe}.
 */
export interface NominalPipeOptions {
  /**
   * Builds the error a rejected value fails the request with.
   *
   * @defaultValue A `BadRequestException` with one message per issue.
   */
  readonly exceptionFactory?: NominalExceptionFactory;
  /**
   * Whether a string from a query string or a route parameter is read as the value of a number or
   * boolean type, so `?page=2` becomes `2`. A `n.of()` schema reads text only through its own
   * `fromString()`.
   *
   * @defaultValue `true`
   */
  readonly fromString?: boolean;
  /**
   * Leaves rejected values out of the messages for every type, before the exception factory sees
   * them, so they don't reach responses or logs. Types declared `sensitive` leave them out anyway.
   *
   * @defaultValue `false`
   */
  readonly hideValues?: boolean;
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

  // Bun and SWC record a schema in place of the type alias that shares its name with it.
  const metatype: unknown = metadata.metatype;

  return isTarget(metatype) ? metatype : undefined;
};

/**
 * Validates a route argument into a nominal type and hands the handler the instance.
 *
 * @remarks
 * Given a type or a `n.of()` schema, it checks that. Given none, it uses the parameter's
 * `{ schema }` on Nest 12 when that is a nominal type or a `n.of()` schema, else the type the
 * parameter is declared with, or the schema Bun and SWC record for a type named like a schema.
 * It passes every other argument through untouched, which makes it safe to bind globally.
 *
 * Declared types lose array items and `?`, so `Uuid[]` needs a schema. A missing value of a
 * declared type is passed on as `undefined`; to require it, give the parameter a pipe of its own
 * or a schema.
 *
 * In a query string, a lone value given to an array schema is wrapped into an array, and a string
 * for a number or boolean type is read as its value, so `?page=2` gives `2`.
 *
 * Works on Nest 11 and 12. Pipes never run on `@Headers()`.
 *
 * @example
 * ```ts
 * import { Controller, Get, Param, Query } from '@nestjs/common';
 * import type { INestApplication } from '@nestjs/common';
 * import { n, Uuid } from '@horizon-republic/nominal-types';
 * import { NominalPipe } from '@horizon-republic/nominal-types/adapters/nest';
 *
 * declare const app: INestApplication;
 *
 * app.useGlobalPipes(new NominalPipe());
 *
 * @Controller('orders')
 * export class OrdersController {
 *   @Get(':id')
 *   public find(@Param('id') id: Uuid): string {
 *     return id.value;
 *   }
 *
 *   @Get()
 *   public list(
 *     @Query('ids', new NominalPipe(n.of(Uuid).array({ max: 100 }))) ids: readonly Uuid[],
 *   ): number {
 *     return ids.length;
 *   }
 * }
 * ```
 */
export class NominalPipe implements PipeTransform<unknown, unknown> {
  readonly #target: NominalPipeTarget | undefined;
  readonly #exceptionFactory: NominalExceptionFactory;
  readonly #fromString: boolean;
  readonly #hideValues: boolean;

  /**
   * Creates a pipe that checks each argument against the schema or type the parameter declares.
   *
   * @param options - How values are read and how a rejected value fails the request.
   */
  public constructor(options?: NominalPipeOptions);
  /**
   * Creates a pipe that checks the argument against `target`.
   *
   * @param target - The nominal type or schema the argument must match.
   * @param options - How values are read and how a rejected value fails the request.
   */
  public constructor(target: NominalPipeTarget, options?: NominalPipeOptions);
  public constructor(
    targetOrOptions?: NominalPipeTarget | NominalPipeOptions,
    options: NominalPipeOptions = {},
  ) {
    const target = isPipeTarget(targetOrOptions) ? targetOrOptions : undefined;
    const settings = isPipeTarget(targetOrOptions) ? options : (targetOrOptions ?? options);

    this.#target = target;
    this.#exceptionFactory = settings.exceptionFactory ?? badRequest;
    this.#fromString = settings.fromString ?? true;
    this.#hideValues = settings.hideValues ?? false;
  }

  /**
   * Checks one route argument. Nest calls it for you.
   *
   * @param value - The argument as the request gave it.
   * @param metadata - Which argument it is, and the type or schema it is declared with.
   * @returns The instance or value the target gives, or `value` untouched when there is no target.
   * @throws {@link BadRequestException} when the target rejects the value, unless
   * `exceptionFactory` builds another error.
   * @throws {@link TypeError} if a Standard Schema checks the value asynchronously.
   */
  public transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const target = this.#target ?? targetOf(metadata);

    if (target === undefined || (value === undefined && this.#onlyDeclared(target, metadata))) {
      return value;
    }

    const parsed = parseAny(target, this.#inputOf(target, value, metadata));

    if (parsed.ok) {
      return parsed.value;
    }

    throw this.#exceptionFactory(
      this.#hideValues ? hideValues(parsed.issues) : parsed.issues,
      metadata,
    );
  }

  // A type read from the declaration can't tell `email?: Email` from `email: Email`, so a missing
  // value is left to a pipe on the parameter or a schema, which say whether it may be missing.
  #onlyDeclared(target: NominalPipeTarget, metadata: ArgumentMetadata): boolean {
    const declared: unknown = metadata.metatype;

    return (
      this.#target === undefined &&
      !isTarget(Reflect.get(metadata, 'schema')) &&
      isNominalType(declared) &&
      target === declared
    );
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
