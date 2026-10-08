import Fastify from 'fastify';
import { describe, expectTypeOf, it } from 'vitest';

import type { NominalTypeProvider } from '../../../src/adapters/fastify/index.ts';
import { Email, n, PositiveInteger, Uuid } from '../../../src/index.ts';
import type { ValueOf } from '../../../src/index.ts';
import { valueOf } from '../../support/results.ts';
import { CreateOrder, id, Order } from './support.ts';

describe('NominalTypeProvider', () => {
  it('types each part of a request by its nominal schema', () => {
    const app = Fastify().withTypeProvider<NominalTypeProvider>();
    const Query = n.object({ page: PositiveInteger });

    app.post(
      '/orders/:id',
      {
        schema: {
          body: CreateOrder,
          params: n.object({ id: Uuid }),
          querystring: Query,
          headers: n.object({ 'x-contact': Email }),
        },
      },
      (request) => {
        expectTypeOf(request.body).toEqualTypeOf<ValueOf<typeof CreateOrder>>();
        expectTypeOf(request.params.id).toEqualTypeOf<Uuid>();
        expectTypeOf(request.query.page).toEqualTypeOf<PositiveInteger>();
        expectTypeOf(request.headers['x-contact']).toEqualTypeOf<Email>();

        return {};
      },
    );
  });

  it('types a single type and a list', () => {
    const app = Fastify().withTypeProvider<NominalTypeProvider>();

    app.post('/emails', { schema: { body: n.of(Email).array() } }, (request) => {
      expectTypeOf(request.body).toEqualTypeOf<readonly Email[]>();

      return {};
    });
    app.post('/email', { schema: { body: Email } }, (request) => {
      expectTypeOf(request.body).toEqualTypeOf<Email>();

      return {};
    });
  });

  it('leaves a part with another schema unknown', () => {
    const app = Fastify().withTypeProvider<NominalTypeProvider>();

    app.post('/plain', { schema: { body: { type: 'object' } } }, (request) => {
      expectTypeOf(request.body).toBeUnknown();

      return {};
    });
  });

  it('types the response by its nominal schema', () => {
    const app = Fastify().withTypeProvider<NominalTypeProvider>();
    const latest = valueOf(Order.parse({ id, quantity: 2, paid: false }));

    expectTypeOf(latest).toEqualTypeOf<ValueOf<typeof Order>>();

    app.get('/orders/latest', { schema: { response: { 200: Order } } }, () => latest);
    app.get('/orders/sent', { schema: { response: { 200: Order } } }, async (_request, reply) => {
      await reply.send(latest);
    });
    // @ts-expect-error: a string is not the value of Order
    app.get('/orders/wrong', { schema: { response: { 200: Order } } }, () => 'nope');
  });
});
