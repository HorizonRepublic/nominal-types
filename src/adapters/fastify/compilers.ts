import type { FastifySchemaValidationError } from 'fastify';

import { hideValues } from '../../core/hidden-values.ts';
import type { StandardSchemaV1 } from '../../core/standard-spec.ts';
import { parseTarget } from '../../core/target.ts';
import type { NominalTarget } from '../../core/target.ts';
import { plainPath } from '../issue-path.ts';
import { targetOf } from './stand-ins.ts';
import { textReaderFor } from './text-input.ts';

/**
 * Options for `nominalValidatorCompiler()` and `fastifyNominal`.
 */
export interface NominalValidatorOptions {
  /**
   * Whether a string in the query string, a route parameter or a header is read as the value of a
   * number or boolean field, so `?page=2` gives `2`, and a lone value for a list becomes a list of
   * one, as `NominalPipe` reads them. On by default.
   */
  readonly fromString?: boolean;
  /**
   * Leaves rejected values out of the messages for every type, so they don't reach responses or
   * logs. Types declared `sensitive` leave them out anyway. Off by default.
   */
  readonly hideValues?: boolean;
}

/**
 * What Fastify tells a compiler about the schema of one part of a route.
 */
export interface FastifyRouteSchema {
  readonly schema: unknown;
  readonly method: string;
  readonly url: string;
  readonly httpPart?: string;
  readonly httpStatus?: string;
}

/**
 * A check of one part of a request: the value the handler gets, or the issues Fastify answers
 * status 400 with.
 */
export type NominalValidator = (
  data: unknown,
) => { readonly value: unknown } | { readonly error: FastifySchemaValidationError[] };

/**
 * Builds the check of one part of a route, as `setValidatorCompiler()` takes it.
 */
export type NominalValidatorCompiler = (route: FastifyRouteSchema) => NominalValidator;

/**
 * Builds the writer of one response of a route, as `setSerializerCompiler()` takes it.
 */
export type NominalSerializerCompiler = (route: FastifyRouteSchema) => (data: unknown) => string;

type Fallback<Compiler> = (() => Compiler) | undefined;

const none = undefined;

const pointerOf = (issue: StandardSchemaV1.Issue): string =>
  plainPath(issue.path ?? [])
    .map((key) => `/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`)
    .join('');

const validationErrorOf = (issue: StandardSchemaV1.Issue): FastifySchemaValidationError => ({
  keyword: 'nominal',
  instancePath: pointerOf(issue),
  schemaPath: '#',
  params: {},
  message: issue.message,
});

const routeName = (route: FastifyRouteSchema): string =>
  `${route.method} ${route.url} ${route.httpPart ?? route.httpStatus ?? ''}`.trimEnd();

const writerOf = (target: NominalTarget): ((data: unknown) => string) => {
  const writer: { stringify(value: unknown): string } = target;

  return (data) => writer.stringify(data);
};

const validatorOf = (
  target: NominalTarget,
  part: string | undefined,
  options: NominalValidatorOptions,
): NominalValidator => {
  const read = options.fromString === false ? undefined : textReaderFor(target, part);
  const hide = options.hideValues === true;

  return (data: unknown) => {
    let parsed = parseTarget(target, read === undefined ? data : read(data));

    // Fastify hands a missing part over as null.
    if (!parsed.ok && data === null) {
      const missing = parseTarget(target, none);

      parsed = missing.ok ? missing : parsed;
    }

    if (parsed.ok) {
      return { value: parsed.value };
    }

    const issues = hide ? hideValues(parsed.issues) : parsed.issues;

    return { error: issues.map((issue) => validationErrorOf(issue)) };
  };
};

/**
 * Internal: the validator compiler, handing a schema that is not nominal to `fallback`.
 */
export const validatorCompilerWith = (
  options: NominalValidatorOptions,
  fallback: Fallback<NominalValidatorCompiler>,
): NominalValidatorCompiler => {
  return (route) => {
    const target = targetOf(route.schema);

    if (target !== undefined) {
      return validatorOf(target, route.httpPart, options);
    }

    if (fallback === undefined) {
      throw new TypeError(
        `nominalValidatorCompiler(): the schema of ${routeName(route)} is not a nominal type or schema; register fastifyNominal to check other JSON Schemas with Fastify's compiler`,
      );
    }

    return fallback()(route);
  };
};

/**
 * Internal: the serializer compiler, handing a schema that is not nominal to `fallback`.
 */
export const serializerCompilerWith = (
  fallback: Fallback<NominalSerializerCompiler>,
): NominalSerializerCompiler => {
  return (route) => {
    const target = targetOf(route.schema);

    if (target !== undefined) {
      return writerOf(target);
    }

    if (fallback === undefined) {
      throw new TypeError(
        `nominalSerializerCompiler(): the schema of ${routeName(route)} is not a nominal type or schema; register fastifyNominal to write other JSON Schemas with Fastify's serializer`,
      );
    }

    return fallback()(route);
  };
};

/**
 * A Fastify validator compiler that checks a request with nominal types and schemas, so the
 * handler gets instances, and a rejected request gets Fastify's status 400 with their messages.
 *
 * @remarks
 * `fastifyNominal` sets it up for you, next to Fastify's own compiler for other JSON Schemas. Use
 * it alone for a route whose every schema is nominal: given another schema, it throws a
 * `TypeError` when the route is compiled.
 *
 * @example
 * ```ts
 * app.post('/orders', {
 *   schema: { body: CreateOrder },
 *   validatorCompiler: nominalValidatorCompiler(),
 * }, handler);
 * ```
 */
export const nominalValidatorCompiler = (
  options: NominalValidatorOptions = {},
): NominalValidatorCompiler => validatorCompilerWith(options, none);

/**
 * A Fastify serializer compiler that writes a response with the schema's `stringify()`, several
 * times faster than writing instances by other means.
 *
 * @remarks
 * `fastifyNominal` sets it up for you, next to Fastify's own serializer for other JSON Schemas.
 * Use it alone for a route whose every response schema is nominal: given another schema, it
 * throws a `TypeError` when the route is compiled.
 *
 * @example
 * ```ts
 * app.get('/orders/:id', {
 *   schema: { response: { 200: Order } },
 *   serializerCompiler: nominalSerializerCompiler(),
 * }, handler);
 * ```
 */
export const nominalSerializerCompiler = (): NominalSerializerCompiler =>
  serializerCompilerWith(none);
