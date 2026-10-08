import 'reflect-metadata';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { beforeAll, describe, expect, it } from 'vitest';

import { NominalPipe } from '../../../src/adapters/nest/index.ts';
import { ApiNominalBody, ApiNominalQuery } from '../../../src/adapters/swagger/index.ts';
import { AnyString, Email, n, Nominal, PositiveInteger, Uuid } from '../../../src/index.ts';
import { documentFor, emailSchema, parameterNamed, uuidSchema } from './support.ts';

class Size extends Nominal('swagger.Size', n.oneOf(1, 'L')) {}

const CreateOrder = n.object({
  customer: Email,
  quantity: PositiveInteger,
  size: Size,
  items: n.of(Uuid).array({ min: 1, max: 5 }),
  address: n.object({ street: AnyString, note: n.of(AnyString).optional() }),
  note: n.of(AnyString).optional(),
});

const createOrderSchema = {
  type: 'object',
  properties: {
    customer: emailSchema,
    quantity: { title: 'nominal.PositiveInteger' },
    items: { type: 'array', minItems: 1, maxItems: 5, items: uuidSchema('nominal.Uuid') },
    address: { type: 'object', required: ['street'] },
    note: { type: 'string' },
  },
  required: ['customer', 'quantity', 'size', 'items', 'address'],
};

const requestBodyOf = (document: OpenAPIObject, path: string): unknown =>
  document.paths[path]?.post?.requestBody;

describe('ApiNominalBody', () => {
  @Controller('orders')
  class OrdersController {
    @Post('inline')
    @ApiNominalBody(CreateOrder)
    public inline(@Body(new NominalPipe(CreateOrder)) order: unknown): unknown {
      return order;
    }

    @Post('named')
    @ApiNominalBody(CreateOrder, { name: 'CreateOrder', description: 'An order' })
    public named(@Body(new NominalPipe(CreateOrder)) order: unknown): unknown {
      return order;
    }

    @Post('again')
    @ApiNominalBody(CreateOrder, { name: 'CreateOrder' })
    public again(@Body(new NominalPipe(CreateOrder)) order: unknown): unknown {
      return order;
    }

    @Post('optional')
    @ApiNominalBody(CreateOrder.optional(), { name: 'MaybeOrder' })
    public optional(@Body(new NominalPipe(CreateOrder.optional())) order: unknown): unknown {
      return order;
    }

    @Post('ids')
    @ApiNominalBody(n.of(Uuid).array({ max: 5 }), { name: 'Ids' })
    public ids(@Body(new NominalPipe(n.of(Uuid).array({ max: 5 }))) ids: unknown): unknown {
      return ids;
    }

    @Post('note')
    @ApiNominalBody(n.object({ note: n.of(AnyString).optional() }), { name: 'Note' })
    public note(@Body() note: unknown): unknown {
      return note;
    }

    @Post('nullable')
    @ApiNominalBody(CreateOrder.nullable(), { name: 'NullableOrder' })
    public nullable(@Body() order: unknown): unknown {
      return order;
    }

    @Post('recorded')
    @ApiNominalBody(CreateOrder, { name: 'CreateOrder' })
    public recorded(@Body() order: unknown): unknown {
      return order;
    }
  }

  // What Bun and SWC record for a parameter typed with an alias named like the schema.
  Reflect.defineMetadata(
    'design:paramtypes',
    [CreateOrder],
    OrdersController.prototype,
    'recorded',
  );

  let document: OpenAPIObject;

  beforeAll(async () => {
    document = await documentFor(OrdersController);
  });

  it('gives a route checked by NominalPipe no request body without it', async () => {
    @Controller('bare')
    class BareController {
      @Post()
      public create(@Body(new NominalPipe(CreateOrder)) order: unknown): unknown {
        return order;
      }
    }

    expect(requestBodyOf(await documentFor(BareController), '/bare')).toBeUndefined();
  });

  it('writes the schema into the request body', () => {
    expect(requestBodyOf(document, '/orders/inline')).toMatchObject({
      required: true,
      content: { 'application/json': { schema: createOrderSchema } },
    });
  });

  it('lists a named object schema once under components and refers to it', () => {
    const reference = { schema: { $ref: '#/components/schemas/CreateOrder' } };

    expect(requestBodyOf(document, '/orders/named')).toMatchObject({
      required: true,
      description: 'An order',
      content: { 'application/json': reference },
    });
    expect(requestBodyOf(document, '/orders/again')).toMatchObject({
      content: { 'application/json': reference },
    });
    expect(document.components?.schemas?.['CreateOrder']).toMatchObject(createOrderSchema);
  });

  it('writes the fields of a component that have no type of their own', () => {
    const size = { title: 'swagger.Size', enum: [1, 'L'] };

    expect(document.components?.schemas?.['CreateOrder']).toMatchObject({
      properties: { size: { allOf: [size] } },
    });
    expect(requestBodyOf(document, '/orders/inline')).toMatchObject({
      content: { 'application/json': { schema: { properties: { size } } } },
    });
  });

  it('replaces the body @nestjs/swagger reads from a recorded schema', () => {
    expect(requestBodyOf(document, '/orders/recorded')).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrder' } } },
    });
  });

  it('marks the body optional when the schema accepts a missing value', () => {
    expect(requestBodyOf(document, '/orders/optional')).toMatchObject({
      required: false,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/MaybeOrder' } } },
    });
  });

  it('writes a schema that is not an object inline, even with a name', () => {
    expect(requestBodyOf(document, '/orders/ids')).toMatchObject({
      content: {
        'application/json': {
          schema: { type: 'array', maxItems: 5, items: uuidSchema('nominal.Uuid') },
        },
      },
    });
    expect(document.components?.schemas).not.toHaveProperty('Ids');
  });

  it('lists an object whose fields may all be missing', () => {
    expect(document.components?.schemas?.['Note']).toMatchObject({
      type: 'object',
      properties: { note: { type: 'string' } },
    });
    expect(document.components?.schemas?.['Note']).not.toHaveProperty('required');
  });

  it('writes an object schema with more keywords inline, even with a name', () => {
    expect(requestBodyOf(document, '/orders/nullable')).toMatchObject({
      content: { 'application/json': { schema: { type: 'object', nullable: true } } },
    });
    expect(document.components?.schemas).not.toHaveProperty('NullableOrder');
  });

  it.each([String, {}, null])('refuses %o', (target) => {
    expect(() => {
      Reflect.apply(ApiNominalBody, undefined, [target]);
    }).toThrow('ApiNominalBody() takes a nominal type or an n.of() schema');
  });
});

describe('ApiNominalQuery', () => {
  @Controller('search')
  class SearchController {
    @Get('ids')
    @ApiNominalQuery('ids', n.of(Uuid).array({ max: 5 }))
    public ids(
      @Query('ids', new NominalPipe(n.of(Uuid).array({ max: 5 }))) ids: readonly Uuid[],
    ): unknown {
      return ids;
    }

    @Get('pages')
    @ApiNominalQuery('page', PositiveInteger, { required: false, description: 'From 1' })
    @ApiNominalQuery('email', n.of(Email).optional())
    public pages(@Query('page') page?: PositiveInteger, @Query('email') email?: Email): unknown {
      return [page, email];
    }

    @Get('reflected')
    public reflected(
      @Query('ids', new NominalPipe(n.of(Uuid).array({ max: 5 }))) ids: readonly Uuid[],
      @Query('page') page?: PositiveInteger,
    ): unknown {
      return [ids, page];
    }
  }

  let document: OpenAPIObject;

  beforeAll(async () => {
    document = await documentFor(SearchController);
  });

  it('shows why it is needed: a list behind a pipe loses its items, a missing value is required', () => {
    expect(parameterNamed(document, '/search/reflected', 'ids')).toMatchObject({
      schema: { type: 'array', items: { type: 'string' } },
    });
    expect(parameterNamed(document, '/search/reflected', 'page')).toMatchObject({
      required: true,
    });
  });

  it('writes a list with its items and bounds', () => {
    expect(parameterNamed(document, '/search/ids', 'ids')).toStrictEqual({
      name: 'ids',
      in: 'query',
      required: true,
      schema: { type: 'array', maxItems: 5, items: uuidSchema('nominal.Uuid') },
    });
  });

  it('marks a value optional when told, or when the schema accepts a missing value', () => {
    expect(parameterNamed(document, '/search/pages', 'page')).toMatchObject({
      required: false,
      description: 'From 1',
      schema: { title: 'nominal.PositiveInteger' },
    });
    expect(parameterNamed(document, '/search/pages', 'email')).toMatchObject({
      required: false,
      schema: emailSchema,
    });
  });

  it('describes each parameter once', () => {
    expect(document.paths['/search/pages']?.get?.parameters).toStrictEqual([
      expect.objectContaining({ name: 'page' }),
      expect.objectContaining({ name: 'email' }),
    ]);
  });

  it.each([String, {}, null])('refuses %o', (target) => {
    expect(() => {
      Reflect.apply(ApiNominalQuery, undefined, ['page', target]);
    }).toThrow('ApiNominalQuery() takes a nominal type or an n.of() schema');
  });
});
