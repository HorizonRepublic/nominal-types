import { Elysia } from 'elysia';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { Email, n, PositiveInteger } from '../../src/index.ts';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

const app = new Elysia()
  .post(
    '/orders',
    ({ body }) => {
      expectTypeOf(body.customer).toEqualTypeOf<Email>();

      return { domain: body.customer.domain, quantity: body.quantity.value };
    },
    { body: CreateOrder },
  )
  .post(
    '/emails',
    ({ body }) => {
      expectTypeOf(body).toEqualTypeOf<Email>();

      return { domain: body.domain };
    },
    { body: Email },
  );

const post = (path: string, body: unknown): Promise<Response> =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

describe('Elysia', () => {
  it('hands the handler instances', async () => {
    const response = await post('/orders', { customer: 'jane@example.com', quantity: 2 });

    await expect(response.json()).resolves.toStrictEqual({ domain: 'example.com', quantity: 2 });
  });

  it('answers a rejected body with status 422', async () => {
    const response = await post('/orders', { customer: 'jane', quantity: 0 });

    expect(response.status).toBe(422);
  });

  it('takes a nominal type class, typed as the class', async () => {
    const response = await post('/emails', 'jane@example.com');

    await expect(response.json()).resolves.toStrictEqual({ domain: 'example.com' });
  });
});
