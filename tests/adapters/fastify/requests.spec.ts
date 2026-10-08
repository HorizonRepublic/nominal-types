import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AnyBoolean,
  AnyString,
  Email,
  Int64,
  n,
  PositiveInteger,
  Uuid,
} from '../../../src/index.ts';
import { answer, CreateOrder, id, nominalApp, rejection, Sku } from './support.ts';
import type { NominalApp } from './support.ts';

const order = { customer: 'jane@example.com', sku: 'ABC-1234', quantity: 2 };

const Search = n.object({
  page: PositiveInteger,
  active: AnyBoolean,
  total: Int64,
  ids: n.of(Uuid).array({ max: 3 }),
  pages: n.of(PositiveInteger).fromString().array(),
  name: AnyString,
  kept: n.of(PositiveInteger).optional(),
});

// Fastify reads `query` as another name of `querystring`, which its types leave out.
const aliased: Record<string, unknown> = { query: n.object({ page: PositiveInteger }) };

describe('fastifyNominal checks requests', () => {
  let app: NominalApp;

  beforeAll(async () => {
    app = await nominalApp();
    app.post('/orders', { schema: { body: CreateOrder } }, (request) => ({
      domain: request.body.customer.domain,
      sku: request.body.sku instanceof Sku,
      quantity: request.body.quantity.value,
      note: request.body.note?.value ?? 'none',
    }));
    app.get('/users/:id', { schema: { params: n.object({ id: Uuid }) } }, (request) => ({
      isUuid: request.params.id instanceof Uuid,
      version: request.params.id.version,
    }));
    app.get('/search', { schema: { querystring: Search.partial() } }, (request) => ({
      page: request.query.page?.value,
      active: request.query.active?.value,
      total: request.query.total?.value.toString(),
      ids: request.query.ids?.map((item) => item.value),
      pages: request.query.pages?.map((item) => item.value),
      name: request.query.name?.value,
      kept: request.query.kept?.value,
    }));
    app.get('/alias', { schema: aliased }, (request) => request.query);
    app.get(
      '/me',
      { schema: { headers: n.object({ 'x-request-id': Uuid, 'x-retries': PositiveInteger }) } },
      (request) => ({
        id: request.headers['x-request-id'].value,
        retries: request.headers['x-retries'].value,
      }),
    );
    app.post('/emails', { schema: { body: n.of(Email).array() } }, (request) => ({
      domains: request.body.map((email) => email.domain),
    }));
    app.post('/maybe', { schema: { body: CreateOrder.optional() } }, (request) => ({
      sent: request.body !== undefined && request.body !== null,
    }));
    app.post('/flag', { schema: { body: AnyBoolean } }, (request) => ({
      flag: request.body.value,
    }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('hands the handler instances for a body', async () => {
    expect(await answer(app, { method: 'POST', url: '/orders', payload: order })).toStrictEqual({
      status: 200,
      body: { domain: 'example.com', sku: true, quantity: 2, note: 'none' },
    });
  });

  it('answers status 400 in Fastify’s shape, with every message and its place', async () => {
    const sent = { customer: 'jane', sku: 'abc', quantity: 0 };

    expect(await answer(app, { method: 'POST', url: '/orders', payload: sent })).toStrictEqual({
      status: 400,
      body: rejection(
        'body/customer must be an email address (was a string of 4 characters), body/sku must be matched by ^[A-Z]{3}-\\d{4}$ (was "abc"), body/quantity must be a positive integer (was 0)',
      ),
    });
  });

  it('names a missing field and a missing body', async () => {
    const { quantity: _, ...withoutQuantity } = order;

    expect(
      await answer(app, { method: 'POST', url: '/orders', payload: withoutQuantity }),
    ).toStrictEqual({ status: 400, body: rejection('body/quantity is required') });
    expect(await answer(app, { method: 'POST', url: '/orders' })).toStrictEqual({
      status: 400,
      body: rejection('body must be an object (was null)'),
    });
  });

  it('lets an optional body be missing', async () => {
    expect(await answer(app, { method: 'POST', url: '/maybe' })).toStrictEqual({
      status: 200,
      body: { sent: false },
    });
    expect(await answer(app, { method: 'POST', url: '/maybe', payload: order })).toStrictEqual({
      status: 200,
      body: { sent: true },
    });
  });

  it('takes a body that is false', async () => {
    expect(
      await answer(app, {
        method: 'POST',
        url: '/flag',
        payload: 'false',
        headers: { 'content-type': 'application/json' },
      }),
    ).toStrictEqual({ status: 200, body: { flag: false } });
  });

  it('places the issue of a list item by its index', async () => {
    expect(
      await answer(app, { method: 'POST', url: '/emails', payload: ['jane@example.com', 'x'] }),
    ).toStrictEqual({
      status: 400,
      body: rejection('body/1 must be an email address (was a string of 1 character)'),
    });
  });

  it('reads a route parameter', async () => {
    expect(await answer(app, { method: 'GET', url: `/users/${id}` })).toStrictEqual({
      status: 200,
      body: { isUuid: true, version: 7 },
    });
    expect(await answer(app, { method: 'GET', url: '/users/nope' })).toStrictEqual({
      status: 400,
      body: rejection('params/id must be a UUID (was "nope")'),
    });
  });

  it('reads numbers, booleans and big integers of a query string from their text', async () => {
    const url = `/search?page=2&active=false&total=9007199254740993&ids=${id}&pages=1&pages=3&name=007`;

    expect(await answer(app, { method: 'GET', url })).toStrictEqual({
      status: 200,
      body: {
        page: 2,
        active: false,
        total: '9007199254740993',
        ids: [id],
        pages: [1, 3],
        name: '007',
      },
    });
  });

  it('refuses text that is not the value', async () => {
    expect(await answer(app, { method: 'GET', url: '/search?page=02' })).toStrictEqual({
      status: 400,
      body: rejection('querystring/page must be a number (was "02")'),
    });
    expect(await answer(app, { method: 'GET', url: '/search?active=yes' })).toStrictEqual({
      status: 400,
      body: rejection('querystring/active must be a boolean (was "yes")'),
    });
    expect(await answer(app, { method: 'GET', url: '/search?page=1&page=2' })).toStrictEqual({
      status: 400,
      body: rejection('querystring/page must be a number (was array)'),
    });
    expect(await answer(app, { method: 'GET', url: '/search?page=' })).toStrictEqual({
      status: 400,
      body: rejection('querystring/page must be a number (was "")'),
    });
  });

  it('reads a field of n.of() from text only through its own fromString()', async () => {
    expect(await answer(app, { method: 'GET', url: '/search?kept=2' })).toStrictEqual({
      status: 400,
      body: rejection('querystring/kept must be a number (was "2")'),
    });
    expect(await answer(app, { method: 'GET', url: '/search?pages=x' })).toStrictEqual({
      status: 400,
      body: rejection('querystring/pages/0 must be a number (was "x")'),
    });
  });

  it('makes a list of one of a lone value, and checks the size of a list', async () => {
    expect(await answer(app, { method: 'GET', url: `/search?ids=${id}` })).toStrictEqual({
      status: 200,
      body: { ids: [id] },
    });
    expect(await answer(app, { method: 'GET', url: `/search?ids=${id}&ids=nope` })).toStrictEqual({
      status: 400,
      body: rejection('querystring/ids/1 must be a UUID (was "nope")'),
    });
    expect(
      await answer(app, { method: 'GET', url: `/search?ids=${id}&ids=${id}&ids=${id}&ids=${id}` }),
    ).toStrictEqual({
      status: 400,
      body: rejection('querystring/ids must have at most 3 items (was 4)'),
    });
  });

  it('takes query as another name of querystring', async () => {
    expect(await answer(app, { method: 'GET', url: '/alias?page=4' })).toStrictEqual({
      status: 200,
      body: { page: 4 },
    });
  });

  it('reads headers from their text', async () => {
    const headers = { 'x-request-id': id, 'x-retries': '3' };

    expect(await answer(app, { method: 'GET', url: '/me', headers })).toStrictEqual({
      status: 200,
      body: { id, retries: 3 },
    });
    expect(
      await answer(app, { method: 'GET', url: '/me', headers: { ...headers, 'x-retries': '0' } }),
    ).toStrictEqual({
      status: 400,
      body: rejection('headers/x-retries must be a positive integer (was 0)'),
    });
  });
});
