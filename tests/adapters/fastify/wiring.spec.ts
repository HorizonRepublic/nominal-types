import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  fastifyNominal,
  nominalSerializerCompiler,
  nominalValidatorCompiler,
} from '../../../src/adapters/fastify/index.ts';
import { n, PositiveInteger, Uuid } from '../../../src/index.ts';
import { answer, CreateOrder, id, nominalApp, rejection, typedApp } from './support.ts';

const count = { type: 'object', properties: { count: { type: 'integer' } }, required: ['count'] };

describe('fastifyNominal leaves other JSON Schemas to Fastify', () => {
  it('checks them with Fastify’s Ajv, next to nominal schemas on the same route', async () => {
    const app = await nominalApp();

    app.post(
      '/orders',
      { schema: { body: CreateOrder, querystring: count } },
      (request) => request.query,
    );

    const order = { customer: 'jane@example.com', sku: 'ABC-1234', quantity: 2 };

    expect(
      await answer(app, { method: 'POST', url: '/orders?count=3', payload: order }),
    ).toStrictEqual({ status: 200, body: { count: 3 } });
    expect(
      await answer(app, { method: 'POST', url: '/orders?count=x', payload: order }),
    ).toStrictEqual({ status: 400, body: rejection('querystring/count must be integer') });
    await app.close();
  });

  it('keeps the ajv options of the server and the shared schemas', async () => {
    const app = Fastify({ ajv: { customOptions: { coerceTypes: false } } });

    app.addSchema({ $id: 'count', ...count });
    await app.register(fastifyNominal);
    app.get('/count', { schema: { querystring: { $ref: 'count#' } } }, () => ({}));
    app.get('/page', { schema: { querystring: n.object({ page: PositiveInteger }) } }, () => ({}));

    expect(await answer(app, { method: 'GET', url: '/count?count=3' })).toStrictEqual({
      status: 400,
      body: rejection('querystring/count must be integer'),
    });
    expect(await answer(app, { method: 'GET', url: '/page?page=3' })).toStrictEqual({
      status: 200,
      body: {},
    });
    await app.close();
  });

  it('wraps a compiler set before the plugin', async () => {
    const app = typedApp();
    const seen: string[] = [];

    app.setValidatorCompiler(({ httpPart }) => {
      seen.push(`validate ${String(httpPart)}`);

      return () => true;
    });
    app.setSerializerCompiler(({ httpStatus }) => {
      seen.push(`write ${String(httpStatus)}`);

      return () => '"custom"';
    });
    await app.register(fastifyNominal);
    app.get(
      '/users/:id',
      {
        schema: {
          params: n.object({ id: Uuid }),
          querystring: count,
          response: { 200: Uuid, 201: count },
        },
      },
      (request) => request.params.id,
    );
    app.get('/plain', { schema: { response: { 200: count } } }, () => ({ count: 1 }));

    expect(await answer(app, { method: 'GET', url: '/users/nope' })).toMatchObject({ status: 400 });
    expect(await answer(app, { method: 'GET', url: `/users/${id}` })).toStrictEqual({
      status: 200,
      body: id,
    });
    expect(await answer(app, { method: 'GET', url: '/plain' })).toStrictEqual({
      status: 200,
      body: 'custom',
    });
    expect([...new Set(seen)].toSorted()).toStrictEqual([
      'validate querystring',
      'write 200',
      'write 201',
    ]);
    await app.close();
  });

  it('works inside the plugin it is registered in, and leaves its siblings alone', async () => {
    const app = Fastify();

    await app.register(async (shop) => {
      const typed = typedApp(shop);

      await typed.register(fastifyNominal);
      typed.get('/users/:id', { schema: { params: n.object({ id: Uuid }) } }, (request) => ({
        isUuid: request.params.id instanceof Uuid,
      }));
    });
    await app.register((other, _options, done) => {
      other.get('/count', { schema: { querystring: count } }, (request) => request.query);
      done();
    });

    expect(await answer(app, { method: 'GET', url: `/users/${id}` })).toStrictEqual({
      status: 200,
      body: { isUuid: true },
    });
    expect(await answer(app, { method: 'GET', url: '/count?count=2' })).toStrictEqual({
      status: 200,
      body: { count: 2 },
    });
    await app.close();
  });

  it('names itself to Fastify as fastify-plugin does', () => {
    expect(Reflect.get(fastifyNominal, Symbol.for('skip-override'))).toBe(true);
    expect(Reflect.get(fastifyNominal, Symbol.for('fastify.display-name'))).toBe('fastifyNominal');
    expect(Reflect.get(fastifyNominal, Symbol.for('plugin-meta'))).toStrictEqual({
      name: 'fastifyNominal',
      fastify: '5.x',
    });
  });

  it('throws for an instance without the schema controller of Fastify 5', () => {
    expect(() => {
      Reflect.apply(fastifyNominal, undefined, [{}, {}, () => {}]);
    }).toThrow(
      new TypeError('fastifyNominal: this version of Fastify is not supported; use Fastify 5'),
    );
  });
});

describe('the compilers alone', () => {
  it('check and write a route whose every schema is nominal', async () => {
    const app = typedApp();

    app.get(
      '/users/:id',
      {
        schema: { params: n.object({ id: Uuid }), response: { 200: Uuid } },
        validatorCompiler: nominalValidatorCompiler({ hideValues: true }),
        serializerCompiler: nominalSerializerCompiler(),
      },
      (request) => request.params.id,
    );

    expect(await answer(app, { method: 'GET', url: `/users/${id}` })).toStrictEqual({
      status: 200,
      body: id,
    });
    expect(await answer(app, { method: 'GET', url: '/users/nope' })).toStrictEqual({
      status: 400,
      body: rejection('params/id must be a UUID (was a string of 4 characters)'),
    });
    await app.close();
  });

  it('refuse another schema when the route is compiled', async () => {
    const validating = Fastify();

    validating.get(
      '/count',
      { schema: { querystring: count }, validatorCompiler: nominalValidatorCompiler() },
      () => ({}),
    );

    await expect(validating.ready()).rejects.toThrow(
      "nominalValidatorCompiler(): the schema of GET /count querystring is not a nominal type or schema; register fastifyNominal to check other JSON Schemas with Fastify's compiler",
    );

    const writing = Fastify();

    writing.get(
      '/count',
      { schema: { response: { 200: count } }, serializerCompiler: nominalSerializerCompiler() },
      () => ({}),
    );

    await expect(writing.ready()).rejects.toThrow(
      "nominalSerializerCompiler(): the schema of GET /count 200 is not a nominal type or schema; register fastifyNominal to write other JSON Schemas with Fastify's serializer",
    );
  });
});
