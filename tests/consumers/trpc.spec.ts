import { initTRPC, TRPCError } from '@trpc/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { Email, n, NominalError, PositiveInteger, Uuid } from '../../src/index.ts';
import type { InputOf } from '../../src/index.ts';

const t = initTRPC.create();

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

const router = t.router({
  createOrder: t.procedure.input(CreateOrder).mutation(({ input }) => ({
    domain: input.customer.domain,
    quantity: input.quantity.value,
  })),
  user: t.procedure.input(Uuid).query(({ input }) => input.version),
  email: t.procedure.input(Email).query(({ input }) => input.domain),
  ids: t.procedure.input(n.of(Uuid).array({ max: 2 })).query(({ input }) => input.length),
  echo: t.procedure
    .input(n.object({ quantity: PositiveInteger }))
    .output(n.object({ quantity: PositiveInteger }))
    .query(({ input }) => (input.quantity.value === 1 ? { quantity: 0 } : input)),
});

const caller = t.createCallerFactory(router)({});

const rejectionOf = async (call: Promise<unknown>): Promise<TRPCError> => {
  const error: unknown = await call.then(
    () => null,
    (reason: unknown) => reason,
  );

  if (!(error instanceof TRPCError)) {
    throw new TypeError('the call was not rejected with a TRPCError');
  }

  return error;
};

const fetchCall = (body: unknown): Promise<Response> =>
  fetchRequestHandler({
    endpoint: '/trpc',
    req: new Request('http://localhost/trpc/createOrder', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    router,
    createContext: () => ({}),
  });

describe('tRPC', () => {
  it('hands the procedure instances for an n.object() schema', async () => {
    await expect(
      caller.createOrder({ customer: 'jane@example.com', quantity: 2 }),
    ).resolves.toStrictEqual({ domain: 'example.com', quantity: 2 });
  });

  it('rejects a bad input with BAD_REQUEST before the procedure runs', async () => {
    const error = await rejectionOf(caller.createOrder({ customer: 'jane', quantity: 0 }));

    expect(error.code).toBe('BAD_REQUEST');
    expect(error.cause).toBeInstanceOf(NominalError);
    expect(error.cause).toMatchObject({
      issues: [
        { message: 'must be an email address (was a string of 4 characters)', path: ['customer'] },
        { message: 'must be a positive integer (was 0)', path: ['quantity'] },
      ],
    });
  });

  it('answers a bad input over HTTP with status 400', async () => {
    const response = await fetchCall({ customer: 'jane', quantity: 0 });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { data: { code: 'BAD_REQUEST', httpStatus: 400 } },
    });
  });

  it('answers a good input over HTTP with status 200', async () => {
    const response = await fetchCall({ customer: 'jane@example.com', quantity: 2 });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      result: { data: { domain: 'example.com', quantity: 2 } },
    });
  });

  it('takes a nominal type class as the input', async () => {
    await expect(caller.user('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f')).resolves.toBe(7);
    await expect(caller.email('jane@example.com')).resolves.toBe('example.com');
    expect((await rejectionOf(caller.user('nope'))).code).toBe('BAD_REQUEST');
    expect((await rejectionOf(caller.email('jane'))).message).toBe(
      'nominal.Email: must be an email address (was a string of 4 characters)',
    );
  });

  it('takes an n.of() schema as the input', async () => {
    await expect(caller.ids(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'])).resolves.toBe(1);
    expect((await rejectionOf(caller.ids(['a', 'b', 'c']))).code).toBe('BAD_REQUEST');
  });

  it('refuses an output the schema rejects', async () => {
    await expect(caller.echo({ quantity: 2 })).resolves.toMatchObject({ quantity: { value: 2 } });
    expect((await rejectionOf(caller.echo({ quantity: 1 }))).code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('types the input as the schema gives it', () => {
    type Inputs = Parameters<typeof caller.createOrder>[0];

    expectTypeOf<Inputs>().toEqualTypeOf<InputOf<typeof CreateOrder>>();
    expectTypeOf(caller.email).returns.resolves.toEqualTypeOf<string>();
  });
});
