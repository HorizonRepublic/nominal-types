import 'reflect-metadata';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NominalPipe } from '../../../src/adapters/nest/index.ts';
import { Email, n, PositiveInteger, Uuid } from '../../../src/index.ts';
import { badRequest, describeIds, first, platforms, start } from './support.ts';
import type { Started } from './support.ts';

const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });

const customerOf = (order: unknown): unknown =>
  typeof order === 'object' && order !== null ? Reflect.get(order, 'customer') : undefined;

const describeOrder = (order: unknown): unknown => {
  const parsed = CreateOrder.parse(order);

  return parsed.ok
    ? { domain: parsed.value.customer.domain, isEmail: customerOf(order) instanceof Email }
    : 'unchecked';
};

@Controller('recorded')
class RecordedController {
  @Post()
  public create(@Body() order: unknown): unknown {
    return describeOrder(order);
  }

  @Post('piped')
  public piped(@Body(new NominalPipe(CreateOrder)) order: unknown): unknown {
    return describeOrder(order);
  }

  @Get()
  public list(@Query('ids') ids: unknown): unknown {
    return { ids: Array.isArray(ids) ? describeIds(ids) : ids };
  }
}

// What Bun and SWC write for `order: CreateOrder` when `type CreateOrder` shares its name with the
// schema: the schema itself, where TypeScript writes `Object`.
Reflect.defineMetadata('design:paramtypes', [CreateOrder], RecordedController.prototype, 'create');
Reflect.defineMetadata('design:paramtypes', [CreateOrder], RecordedController.prototype, 'piped');
Reflect.defineMetadata(
  'design:paramtypes',
  [n.of(Uuid).array({ max: 2 })],
  RecordedController.prototype,
  'list',
);

describe.each(platforms)('a global pipe with schemas recorded by Bun or SWC on %s', (platform) => {
  let started: Started;

  beforeAll(async () => {
    started = await start(RecordedController, [new NominalPipe()], platform);
  });

  afterAll(async () => {
    await started.app.close();
  });

  it('checks a body against the recorded schema', async () => {
    expect(
      await started.post('/recorded', { customer: 'jane@example.com', quantity: 2 }),
    ).toStrictEqual({
      status: 201,
      body: { domain: 'example.com', isEmail: true },
    });
    expect(await started.post('/recorded', { customer: 'jane', quantity: 2 })).toStrictEqual(
      badRequest('customer: must be an email address (was a string of 4 characters)'),
    );
  });

  it('works next to a pipe on the parameter with the same schema', async () => {
    expect(
      await started.post('/recorded/piped', { customer: 'jane@example.com', quantity: 2 }),
    ).toStrictEqual({
      status: 201,
      body: { domain: 'example.com', isEmail: true },
    });
    expect((await started.post('/recorded/piped', { customer: 'jane@example.com' })).status).toBe(
      400,
    );
  });

  it('checks a list in a query string', async () => {
    expect(await started.get(`/recorded?ids=${first}`)).toStrictEqual({
      status: 200,
      body: { ids: [{ id: first, isUuid: true }] },
    });
    expect(await started.get('/recorded?ids=a&ids=b&ids=c')).toStrictEqual(
      badRequest('ids: must have at most 2 items (was 3)'),
    );
  });
});
