import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { Email, n, PositiveInteger, Uuid } from '../../../src/index.ts';
import { answer, CreateOrder, nominalApp, rejection } from './support.ts';

const order = { customer: 'jane@example.com', sku: 'ABC-1234', quantity: 2 };

const Lines = n.object({
  lines: n
    .of(PositiveInteger)
    .array()
    .check((counts, report) => {
      counts.forEach((count, index) => {
        if (count.value > 10) report({ path: [index], code: 'too_many', message: 'over 10' });
      });
    }),
});

describe('fastifyNominal options', () => {
  it('leaves text as text with fromString: false', async () => {
    const app = await nominalApp({ fromString: false });

    app.get(
      '/search',
      { schema: { querystring: n.object({ page: PositiveInteger }) } },
      () => ({}),
    );

    expect(await answer(app, { method: 'GET', url: '/search?page=2' })).toStrictEqual({
      status: 400,
      body: rejection('querystring/page must be a number (was "2")'),
    });
    await app.close();
  });

  it('leaves values out of messages with hideValues', async () => {
    const app = await nominalApp({ hideValues: true });

    app.get('/users/:id', { schema: { params: n.object({ id: Uuid }) } }, () => ({}));

    expect(await answer(app, { method: 'GET', url: '/users/nope' })).toStrictEqual({
      status: 400,
      body: rejection('params/id must be a UUID (was a string of 4 characters)'),
    });
    await app.close();
  });

  it('writes keys with a slash or a tilde as JSON Pointer writes them', async () => {
    const app = await nominalApp();

    app.post('/odd', { schema: { body: n.object({ 'a/b~c': PositiveInteger }) } }, () => ({}));

    expect(
      await answer(app, { method: 'POST', url: '/odd', payload: { 'a/b~c': 0 } }),
    ).toStrictEqual({
      status: 400,
      body: rejection('body/a~1b~0c must be a positive integer (was 0)'),
    });
    await app.close();
  });

  it('gives the issues to attachValidation and a schemaErrorFormatter', async () => {
    const app = await nominalApp();

    app.post(
      '/orders',
      { schema: { body: CreateOrder }, attachValidation: true },
      (request) => request.validationError?.validation,
    );
    app.post(
      '/formatted',
      {
        schema: { body: CreateOrder },
        schemaErrorFormatter: (errors, part) =>
          new Error(`${part}: ${errors.map((error) => error.message).join('; ')}`),
      },
      () => ({}),
    );

    expect(
      await answer(app, { method: 'POST', url: '/orders', payload: { ...order, quantity: 0 } }),
    ).toStrictEqual({
      status: 200,
      body: [
        {
          keyword: 'nominal',
          instancePath: '/quantity',
          schemaPath: '#',
          params: {},
          message: 'must be a positive integer (was 0)',
        },
      ],
    });
    expect(
      await answer(app, { method: 'POST', url: '/formatted', payload: { ...order, quantity: 0 } }),
    ).toStrictEqual({ status: 400, body: rejection('body: must be a positive integer (was 0)') });
    await app.close();
  });

  it('gives every issue of a rule with its path in the validation array', async () => {
    const app = await nominalApp();

    app.post(
      '/lines',
      { schema: { body: Lines }, attachValidation: true },
      (request) => request.validationError?.validation,
    );

    expect(
      await answer(app, { method: 'POST', url: '/lines', payload: { lines: [11, 2, 12] } }),
    ).toStrictEqual({
      status: 200,
      body: [
        {
          keyword: 'nominal',
          instancePath: '/lines/0',
          schemaPath: '#',
          params: {},
          message: 'over 10',
        },
        {
          keyword: 'nominal',
          instancePath: '/lines/2',
          schemaPath: '#',
          params: {},
          message: 'over 10',
        },
      ],
    });
    await app.close();
  });

  it('checks and writes a body of one of several shapes', async () => {
    const app = await nominalApp();
    const Payment = n.union('method', {
      card: n.object({ token: PositiveInteger }),
      invoice: n.object({ email: Email }),
    });

    app.post(
      '/pay',
      { schema: { body: Payment, response: { 200: Payment } } },
      (request) => request.body,
    );

    expect(
      await answer(app, { method: 'POST', url: '/pay', payload: { method: 'card', token: 7 } }),
    ).toStrictEqual({ status: 200, body: { method: 'card', token: 7 } });
    expect(
      await answer(app, {
        method: 'POST',
        url: '/pay',
        payload: { method: 'invoice', email: 'x' },
      }),
    ).toStrictEqual({
      status: 400,
      body: rejection('body/email must be an email address (was a string of 1 character)'),
    });
    await app.close();
  });

  it('checks with a type and a schema built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const app = await nominalApp();

    app.post('/emails', { schema: { body: copy.n.of(copy.Email).array() } }, (request) => ({
      domains: request.body.map((email) => email.domain),
    }));
    app.post('/flag', { schema: { body: copy.AnyBoolean } }, (request) => ({
      flag: request.body.value,
    }));

    expect(
      await answer(app, { method: 'POST', url: '/emails', payload: ['jane@example.com'] }),
    ).toStrictEqual({ status: 200, body: { domains: ['example.com'] } });
    expect(
      await answer(app, {
        method: 'POST',
        url: '/flag',
        payload: 'true',
        headers: { 'content-type': 'application/json' },
      }),
    ).toStrictEqual({ status: 200, body: { flag: true } });
    await app.close();
  });
});
