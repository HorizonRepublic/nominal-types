import { describe, expect, it } from 'vitest';

import {
  nominalSerializerCompiler,
  nominalValidatorCompiler,
} from '../../../src/adapters/fastify/index.ts';
import { Email, n, PositiveInteger } from '../../../src/index.ts';
import { answer, nominalApp } from './support.ts';

const route = { method: 'GET', url: '/search' };

describe('nominalValidatorCompiler', () => {
  it('passes a part that is not an object to the schema as it is', () => {
    const validate = nominalValidatorCompiler()({
      ...route,
      schema: n.object({ page: PositiveInteger }),
      httpPart: 'querystring',
    });

    expect(validate('page=2')).toStrictEqual({
      error: [
        {
          keyword: 'nominal',
          instancePath: '',
          schemaPath: '#',
          params: {},
          message: 'must be an object (was "page=2")',
        },
      ],
    });
  });

  it('reads nothing for an object without fields of a type with text', () => {
    const validate = nominalValidatorCompiler()({
      ...route,
      schema: n.object({ contact: n.of(Email) }),
      httpPart: 'querystring',
    });

    expect(validate({ contact: 'jane@example.com' })).toMatchObject({
      value: { contact: new Email('jane@example.com') },
    });
  });

  it('names a route without a part in its error', () => {
    expect(() => nominalValidatorCompiler()({ ...route, schema: { type: 'object' } })).toThrow(
      "nominalValidatorCompiler(): the schema of GET /search is not a nominal type or schema; register fastifyNominal to check other JSON Schemas with Fastify's compiler",
    );
  });

  it('writes with a nominal type', () => {
    const write = nominalSerializerCompiler()({ ...route, schema: Email, httpStatus: '200' });

    expect(write(new Email('jane@example.com'))).toBe('"jane@example.com"');
  });
});

describe('fastifyNominal with routes it leaves alone', () => {
  it('serves a route without a schema, and a schema of true', async () => {
    const app = await nominalApp();
    const anything: Record<string, unknown> = { body: true };

    app.get('/ping', () => ({ ok: true }));
    app.post('/anything', { schema: anything }, (request) => ({ got: request.body }));

    expect(await answer(app, { method: 'GET', url: '/ping' })).toStrictEqual({
      status: 200,
      body: { ok: true },
    });
    expect(
      await answer(app, { method: 'POST', url: '/anything', payload: { a: 1 } }),
    ).toStrictEqual({ status: 200, body: { got: { a: 1 } } });
    await app.close();
  });
});
