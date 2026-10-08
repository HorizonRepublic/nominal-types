import 'reflect-metadata';
import { Controller, Get, NotFoundException, UseInterceptors } from '@nestjs/common';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { FastifyAdapter, RouteSchema } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { lastValueFrom, of } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  NominalResponse,
  NominalResponseInterceptor,
  NominalSerializerInterceptor,
} from '../../../src/adapters/nest/index.ts';
import { AnyBoolean, AnyString, Email, n, Uuid } from '../../../src/index.ts';
import type { ValueOf } from '../../../src/index.ts';
import { valueOf } from '../../support/results.ts';
import { first, platforms } from './support.ts';
import type { Platform } from './support.ts';

const Order = n.object({
  id: Uuid,
  contact: Email,
  paid: AnyBoolean,
  note: n.of(AnyString).nullable(),
});

const order = valueOf(
  Order.parse({ id: first, contact: 'jane@example.com', paid: false, note: 'a "quoted" note' }),
);
const orderText = `{"id":"${first}","contact":"jane@example.com","paid":false,"note":"a \\"quoted\\" note"}`;
const orderJson = Order['~standard'].jsonSchema.output({ target: 'draft-07' });

@Controller('orders')
class OrdersController {
  @Get('latest')
  @NominalResponse(Order)
  public latest(): ValueOf<typeof Order> {
    return order;
  }

  @Get('later')
  @NominalResponse(Order)
  public later(): Promise<ValueOf<typeof Order>> {
    return Promise.resolve(order);
  }

  @Get('list')
  @NominalResponse(Order.array())
  public list(): ReadonlyArray<ValueOf<typeof Order>> {
    return [order, order];
  }

  @Get('id')
  @NominalResponse(Uuid)
  public id(): Uuid {
    return order.id;
  }

  @Get('missing')
  @NominalResponse(Order)
  public missing(): ValueOf<typeof Order> {
    throw new NotFoundException('no order');
  }

  @Get('schema')
  @RouteSchema({ response: { 200: orderJson } })
  @NominalResponse(Order)
  public withSchema(): ValueOf<typeof Order> {
    return order;
  }
}

@Controller('all')
@UseInterceptors(new NominalResponseInterceptor(Uuid))
class IdsController {
  @Get()
  public id(): Uuid {
    return order.id;
  }
}

const serve = async (
  platform: Platform,
  global: boolean,
): Promise<{
  app: INestApplication;
  get: (path: string) => Promise<{ status: number; type: string | null; text: string }>;
}> => {
  const module = await Test.createTestingModule({
    controllers: [OrdersController, IdsController],
  }).compile();
  const app = module.createNestApplication(
    platform === 'fastify' ? new FastifyAdapter() : new ExpressAdapter(),
  );

  if (global) {
    app.useGlobalInterceptors(new NominalSerializerInterceptor(app.get(Reflector)));
  }

  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();

  return {
    app,
    get: async (path) => {
      const response = await fetch(`${base}${path}`);

      return {
        status: response.status,
        type: response.headers.get('content-type'),
        text: await response.text(),
      };
    },
  };
};

describe.each(
  platforms.flatMap((platform) => [
    [platform, false],
    [platform, true],
  ]) as Array<[Platform, boolean]>,
)('NominalResponse on %s, NominalSerializerInterceptor too: %s', (platform, global) => {
  let served: Awaited<ReturnType<typeof serve>>;

  beforeAll(async () => {
    served = await serve(platform, global);
  });

  afterAll(async () => {
    await served.app.close();
  });

  it.each(['/orders/latest', '/orders/later'])('writes the value of %s as JSON', async (path) => {
    expect(await served.get(path)).toStrictEqual({
      status: 200,
      type: 'application/json; charset=utf-8',
      text: orderText,
    });
  });

  it('writes a list and a single instance', async () => {
    expect((await served.get('/orders/list')).text).toBe(`[${orderText},${orderText}]`);
    expect((await served.get('/orders/id')).text).toBe(`"${first}"`);
    expect((await served.get('/all')).text).toBe(`"${first}"`);
  });

  it('leaves an error answer as Nest writes it', async () => {
    const answer = await served.get('/orders/missing');

    expect(answer.status).toBe(404);
    expect(JSON.parse(answer.text)).toMatchObject({ statusCode: 404, message: 'no order' });
  });
});

describe('NominalResponse on a Fastify route with a response schema', () => {
  let served: Awaited<ReturnType<typeof serve>>;

  beforeAll(async () => {
    served = await serve('fastify', false);
  });

  afterAll(async () => {
    await served.app.close();
  });

  it('writes false as false, which Fastify writes as true from instances', async () => {
    expect((await served.get('/orders/schema')).text).toBe(orderText);
  });
});

describe('NominalResponseInterceptor outside HTTP', () => {
  it('passes the value as it is', async () => {
    const interceptor = new NominalResponseInterceptor(Order);
    // A context from a microservice: only getType() is read.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;
    const result = interceptor.intercept(context, { handle: () => of(order) });

    expect(await lastValueFrom(result)).toBe(order);
  });
});
