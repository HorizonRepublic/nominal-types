import type { FastifyTypeProvider } from 'fastify';

import type { AnyNominalType } from '../../core/contracts.ts';
import type { TypeSchema } from '../../core/type-schema.ts';

type NominalValue<Schema> =
  Schema extends TypeSchema<unknown, unknown>
    ? NonNullable<Schema['~standard']['types']>['output']
    : Schema extends AnyNominalType
      ? Schema['prototype']
      : unknown;

/**
 * Types each part of a request, and each response, by the nominal schema of the route, so
 * `request.body` of `schema: { body: CreateOrder }` is `ValueOf<typeof CreateOrder>`.
 *
 * @remarks
 * A part with a schema that is not nominal stays `unknown`. A response with a nominal schema takes
 * the values that schema gives, such as instances.
 *
 * @example
 * ```ts
 * const app = Fastify().withTypeProvider<NominalTypeProvider>();
 *
 * await app.register(fastifyNominal);
 * app.post('/orders', { schema: { body: CreateOrder } }, (request) => request.body.customer.domain);
 * ```
 */
export interface NominalTypeProvider extends FastifyTypeProvider {
  readonly validator: NominalValue<this['schema']>;
  readonly serializer: NominalValue<this['schema']>;
}
