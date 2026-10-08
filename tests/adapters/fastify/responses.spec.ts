import swagger from '@fastify/swagger';
import { describe, expect, it } from 'vitest';

import { fastifyNominal } from '../../../src/adapters/fastify/index.ts';
import type { FastifyNominalOptions } from '../../../src/adapters/fastify/index.ts';
import { AnyBoolean, Email, n, PositiveInteger, PositiveNumber, Uuid } from '../../../src/index.ts';
import { valueOf } from '../../support/results.ts';
import { answer, CreateOrder, id, nominalApp, Order, typedApp } from './support.ts';

const latest = valueOf(Order.parse({ id, quantity: 2, paid: false }));

const isEven = (value: unknown): value is number => typeof value === 'number' && value % 2 === 0;

class Even extends PositiveInteger.subtype('shop.Even', n.satisfying(isEven, 'even')) {}

const Price = n.object({ price: PositiveNumber });

const json = { 'content-type': 'application/json' };

// A step by step walk into the JSON of a Swagger document.
const at = (value: unknown, ...keys: string[]): unknown => {
  let current = value;

  for (const key of keys) {
    current =
      typeof current === 'object' && current !== null ? Reflect.get(current, key) : undefined;
  }

  return current;
};

const documentOf = async (options: FastifyNominalOptions = {}): Promise<unknown> => {
  const app = typedApp();

  await app.register(swagger, { openapi: { info: { title: 'Shop', version: '1.0.0' } } });
  await app.register(fastifyNominal, options);
  app.post(
    '/orders/:id',
    {
      schema: {
        params: n.object({ id: Uuid }),
        querystring: n.object({ dryRun: AnyBoolean }).partial(),
        body: CreateOrder,
        response: { 201: Order },
      },
    },
    () => latest,
  );
  app.get('/prices', { schema: { response: { 200: Price } } }, () =>
    valueOf(Price.parse({ price: 1 })),
  );
  app.post('/even', { schema: { body: Even } }, (request) => ({ value: request.body.value }));
  await app.ready();

  const document = app.swagger();

  await app.close();

  return document;
};

const priceIn = (body: object): object => ({
  200: { content: { 'application/json': { schema: { properties: { price: body } } } } },
});

describe('fastifyNominal writes responses', () => {
  it('writes a response with the schema, false and all', async () => {
    const app = await nominalApp();

    app.get('/orders/latest', { schema: { response: { 200: Order } } }, () => latest);

    const response = await app.inject({ method: 'GET', url: '/orders/latest' });

    expect(response.body).toBe(`{"id":"${id}","quantity":2,"paid":false}`);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    await app.close();
  });

  it('writes only the fields the schema declares', async () => {
    const app = await nominalApp();
    const Short = n.object({ id: Uuid });

    app.get('/orders/latest', { schema: { response: { 200: Short } } }, () =>
      valueOf(Short.parse(latest)),
    );

    expect(await answer(app, { method: 'GET', url: '/orders/latest' })).toStrictEqual({
      status: 200,
      body: { id },
    });
    await app.close();
  });

  it('writes a list, a nullable field and one instance', async () => {
    const app = await nominalApp();
    const Contact = n.object({ email: n.of(Email).nullable() });

    app.get('/orders', { schema: { response: { 200: Order.array() } } }, () => [latest, latest]);
    app.get('/contact', { schema: { response: { 200: Contact } } }, () =>
      valueOf(Contact.parse({ email: null })),
    );
    app.get('/id', { schema: { response: { 200: Uuid } } }, () => new Uuid(id));

    expect(await answer(app, { method: 'GET', url: '/orders' })).toStrictEqual({
      status: 200,
      body: [n.plain(latest), n.plain(latest)],
    });
    expect(await answer(app, { method: 'GET', url: '/contact' })).toStrictEqual({
      status: 200,
      body: { email: null },
    });
    expect(await answer(app, { method: 'GET', url: '/id' })).toStrictEqual({
      status: 200,
      body: id,
    });
    await app.close();
  });

  it('writes a status without a nominal schema with Fastify’s serializer', async () => {
    const app = await nominalApp();
    const missing = { type: 'object', properties: { reason: { type: 'string' } } };

    app.get(
      '/orders/old',
      { schema: { response: { 200: Order, 404: missing } } },
      async (_request, reply) => {
        await reply.code(404).send({ reason: 'gone', extra: true });
      },
    );

    expect(await answer(app, { method: 'GET', url: '/orders/old' })).toStrictEqual({
      status: 404,
      body: { reason: 'gone' },
    });
    await app.close();
  });

  it('writes a response given by content type', async () => {
    const app = await nominalApp();

    app.get(
      '/orders/latest',
      { schema: { response: { 200: { content: { 'application/json': { schema: Order } } } } } },
      () => latest,
    );

    expect(await answer(app, { method: 'GET', url: '/orders/latest' })).toStrictEqual({
      status: 200,
      body: { id, quantity: 2, paid: false },
    });
    await app.close();
  });
});

describe('fastifyNominal shows JSON Schema to @fastify/swagger', () => {
  it('documents the parameters, the body and the response', async () => {
    const route = at(await documentOf(), 'paths', '/orders/{id}', 'post');

    expect(at(route, 'parameters')).toMatchObject([
      { in: 'query', name: 'dryRun', required: false, schema: { type: 'boolean' } },
      { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
    ]);
    expect(at(route, 'requestBody')).toMatchObject({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['customer', 'sku', 'quantity'],
            properties: {
              customer: { type: 'string', format: 'email' },
              sku: { type: 'string', pattern: '^[A-Z]{3}-\\d{4}$' },
              quantity: { type: 'integer', minimum: 1 },
              note: { type: 'string' },
            },
          },
        },
      },
    });
    expect(at(route, 'responses')).toMatchObject({
      201: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { id: { format: 'uuid' }, paid: { type: 'boolean' } },
            },
          },
        },
      },
    });
    expect(JSON.stringify(route)).not.toContain('$schema');
  });

  it('writes the dialect asked for', async () => {
    const draft = at(await documentOf(), 'paths', '/prices', 'get', 'responses');
    const openApi = at(
      await documentOf({ jsonSchemaTarget: 'openapi-3.0' }),
      'paths',
      '/prices',
      'get',
      'responses',
    );

    expect(draft).toMatchObject(priceIn({ type: 'number', exclusiveMinimum: 0 }));
    expect(openApi).toMatchObject(priceIn({ type: 'number', minimum: 0, exclusiveMinimum: true }));
  });

  it('shows an empty schema for a type that can’t describe itself', async () => {
    expect(at(await documentOf(), 'paths', '/even', 'post', 'requestBody')).toMatchObject({
      content: { 'application/json': { schema: {} } },
    });
  });

  it('still checks a type that can’t describe itself', async () => {
    const app = await nominalApp();

    app.post('/even', { schema: { body: Even } }, (request) => ({ value: request.body.value }));

    expect(
      await answer(app, { method: 'POST', url: '/even', payload: '3', headers: json }),
    ).toMatchObject({ status: 400 });
    expect(
      await answer(app, { method: 'POST', url: '/even', payload: '4', headers: json }),
    ).toStrictEqual({ status: 200, body: { value: 4 } });
    await app.close();
  });
});
