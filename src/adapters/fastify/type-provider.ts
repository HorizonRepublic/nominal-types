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
 * import Fastify from 'fastify';
 * import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
 * import { fastifyNominal } from '@horizon-republic/nominal-types/adapters/fastify';
 * import type { NominalTypeProvider } from '@horizon-republic/nominal-types/adapters/fastify';
 *
 * const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });
 * const app = Fastify().withTypeProvider<NominalTypeProvider>();
 *
 * await app.register(fastifyNominal);
 *
 * app.post('/orders', { schema: { body: CreateOrder } }, async (request) => ({
 *   domain: request.body.customer.domain,
 * }));
 * ```
 */
export interface NominalTypeProvider extends FastifyTypeProvider {
  /**
   * The type a request part gets from its schema.
   */
  readonly validator: NominalValue<this['schema']>;
  /**
   * The type a response takes for its schema.
   */
  readonly serializer: NominalValue<this['schema']>;
}
