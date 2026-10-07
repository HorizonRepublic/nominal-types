import 'reflect-metadata';
import { Body, Controller, Get, Post, Query, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NominalField } from '../../../src/adapters/class-validator/index.ts';
import { Email, PositiveInteger, schemaOf, Uuid } from '../../../src/index.ts';

const first = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

class AddressDto {
  @NominalField(Email)
  public email!: Email;
}

class CreateOrderDto {
  @NominalField(Email)
  public contact!: Email;

  @NominalField(schemaOf(Uuid).array({ min: 1 }))
  public items!: readonly Uuid[];

  @NominalField(schemaOf(Email).optional())
  public backup?: Email;

  @ValidateNested()
  @Type(() => AddressDto)
  public billing!: AddressDto;
}

class SearchDto {
  @NominalField(schemaOf(PositiveInteger).fromString())
  public page!: PositiveInteger;

  @NominalField(schemaOf(Uuid).array().optional())
  public ids?: readonly Uuid[];
}

@Controller('orders')
class OrdersController {
  @Post()
  public create(@Body() order: CreateOrderDto): unknown {
    return {
      contact: order.contact instanceof Email ? order.contact.domain : 'plain',
      items: order.items.map((item) => item instanceof Uuid),
      billing: order.billing.email instanceof Email,
    };
  }

  @Get()
  public search(@Query() query: SearchDto): unknown {
    return { page: query.page.value, isPositive: query.page instanceof PositiveInteger };
  }
}

describe('NominalField with ValidationPipe', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [OrdersController] }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = async (payload: object): Promise<{ status: number; body: unknown }> => {
    const response = await app.inject({ method: 'POST', url: '/orders', payload });

    return { status: response.statusCode, body: response.json() };
  };

  const order = {
    contact: 'jane@example.com',
    items: [first],
    billing: { email: 'bill@example.com' },
  };

  it('hands the handler instances in the body', async () => {
    expect(await post(order)).toStrictEqual({
      status: 201,
      body: { contact: 'example.com', items: [true], billing: true },
    });
  });

  it('answers 400 with every message, nested ones prefixed', async () => {
    expect(
      await post({ ...order, contact: 'nope', items: ['x'], billing: { email: 'y' } }),
    ).toStrictEqual({
      status: 400,
      body: {
        statusCode: 400,
        error: 'Bad Request',
        message: [
          'contact: must be an email address (was "nope")',
          'items.0: must be a UUID (was "x")',
          'billing.email: must be an email address (was "y")',
        ],
      },
    });
  });

  it('rejects unknown properties next to nominal ones', async () => {
    expect((await post({ ...order, extra: 1 })).body).toMatchObject({
      message: ['property extra should not exist'],
    });
  });

  it('reads numbers in a query DTO through fromString()', async () => {
    const response = await app.inject({ method: 'GET', url: '/orders?page=3' });

    expect(response.json()).toStrictEqual({ page: 3, isPositive: true });
    expect((await app.inject({ method: 'GET', url: '/orders?page=0' })).json()).toMatchObject({
      message: ['page: must be a positive integer (was 0)'],
    });
  });
});
