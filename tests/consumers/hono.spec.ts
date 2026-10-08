import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { Email, n, PositiveInteger } from '../../src/index.ts';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

const app = new Hono()
  .post('/orders', sValidator('json', CreateOrder), (c) => {
    const order = c.req.valid('json');

    expectTypeOf(order.customer).toEqualTypeOf<Email>();

    return c.json({ domain: order.customer.domain, quantity: order.quantity.value }, 201);
  })
  .post('/emails', sValidator('json', Email), (c) => {
    const email = c.req.valid('json');

    expectTypeOf(email).toEqualTypeOf<Email>();

    return c.json({ domain: email.domain });
  });

const post = (path: string, body: unknown): Promise<Response> | Response =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('Hono', () => {
  it('hands the handler instances', async () => {
    const response = await post('/orders', { customer: 'jane@example.com', quantity: 2 });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toStrictEqual({ domain: 'example.com', quantity: 2 });
  });

  it('answers a rejected body with status 400', async () => {
    const response = await post('/orders', { customer: 'jane', quantity: 0 });

    expect(response.status).toBe(400);
  });

  it('takes a nominal type class, typed as the class', async () => {
    const response = await post('/emails', 'jane@example.com');

    await expect(response.json()).resolves.toStrictEqual({ domain: 'example.com' });
    expect((await post('/emails', 'jane')).status).toBe(400);
  });
});
