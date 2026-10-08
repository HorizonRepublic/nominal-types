import 'temporal-polyfill/global';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnyBoolean, AnyString, Email, Int64, n, PositiveInteger } from '../../../src/index.ts';
import type { StandardJSONSchemaV1 } from '../../../src/index.ts';
import { Instant } from '../../../src/temporal/index.ts';
import { valueOf } from '../../support/results.ts';

// What the NestJS guide says about Fastify routes with a response schema, which go through
// fast-json-stringify instead of JSON.stringify().
const Order = n.object({
  contact: Email,
  quantity: PositiveInteger,
  paid: AnyBoolean,
  total: Int64,
  note: n.of(AnyString).nullable(),
  placed: Instant,
});

const order = valueOf(
  Order.parse({
    contact: 'jane@example.com',
    quantity: 2,
    paid: false,
    total: '12',
    note: null,
    placed: '2024-05-01T09:30:00Z',
  }),
);

const describeAs = (schema: {
  readonly '~standard': { readonly jsonSchema: StandardJSONSchemaV1.Converter };
}): object => {
  const { $schema: _, ...body } = schema['~standard'].jsonSchema.output({ target: 'draft-07' });

  return body;
};

const fastify = new FastifyAdapter().getInstance();
const responseSchema = { response: { 200: describeAs(Order) } };

const fields = {
  paid: n.object({ paid: AnyBoolean }),
  note: n.object({ note: n.of(Email).nullable() }),
  placed: n.object({ placed: Instant }),
};

beforeAll(async () => {
  fastify.get('/to-plain', { schema: responseSchema }, () => Order.toPlain(order));
  fastify.get('/n-plain', { schema: responseSchema }, () => n.plain(order));

  for (const [name, schema] of Object.entries(fields)) {
    const parsed = schema.parse({
      paid: false,
      note: 'jane@example.com',
      placed: '2024-05-01T09:30:00Z',
    });
    const value: unknown = parsed.ok ? parsed.value : undefined;

    fastify.get(
      `/instances/${name}`,
      { schema: { response: { 200: describeAs(schema) } } },
      () => value,
    );
  }

  await fastify.ready();
});

afterAll(async () => {
  await fastify.close();
});

describe('a Fastify route with a response schema', () => {
  it('writes an AnyBoolean holding false as true', async () => {
    const reply = await fastify.inject({ url: '/instances/paid' });

    expect(reply.body).toBe('{"paid":true}');
  });

  it.each(['note', 'placed'])('fails with status 500 for a field of %s', async (name) => {
    const reply = await fastify.inject({ url: `/instances/${name}` });

    expect(reply.statusCode).toBe(500);
  });

  it.each(['/to-plain', '/n-plain'])('writes plain values from %s', async (url) => {
    const reply = await fastify.inject({ url });

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBe(JSON.stringify(order));
  });
});
