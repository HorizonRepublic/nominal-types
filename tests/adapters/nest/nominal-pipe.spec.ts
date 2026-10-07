import 'reflect-metadata';
import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { type } from 'arktype';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { fromArk, toArk } from '../../../src/adapters/arktype/index.ts';
import { NominalPipe } from '../../../src/adapters/nest/index.ts';
import { toZod } from '../../../src/adapters/zod/index.ts';
import { Email, Uuid } from '../../../src/index.ts';

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

const body: ArgumentMetadata = { type: 'body', metatype: Object };

const param = (metatype: ArgumentMetadata['metatype'], data = 'id'): ArgumentMetadata => ({
  type: 'param',
  data,
  metatype,
});

const thrownBy = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }

  throw new Error('expected the call to throw');
};

@Controller('users')
class UsersController {
  @Get(':id')
  public find(@Param('id') userId: Uuid): Record<string, unknown> {
    return { id: userId, isUuid: userId instanceof Uuid, version: userId.version };
  }

  @Get(':id/raw')
  public raw(@Param('id') userId: string): Record<string, unknown> {
    return { id: userId, type: typeof userId };
  }

  @Get()
  public byEmail(@Query('email', new NominalPipe(Email)) email: Email): Record<string, unknown> {
    return { email, mailbox: email.mailbox };
  }
}

describe('NominalPipe', () => {
  describe('reading the declared type', () => {
    const pipe = new NominalPipe();

    it('builds the instance for a parameter declared with a nominal type', () => {
      const result = pipe.transform(id, param(Uuid));

      expect(result).toBeInstanceOf(Uuid);
    });

    it('passes arguments of other types through untouched', () => {
      expect(pipe.transform('anything', param(String))).toBe('anything');
      expect(pipe.transform('anything', { type: 'param', data: 'id' })).toBe('anything');
    });

    it('fails the request with a 400 naming the parameter', () => {
      const error = thrownBy(() => pipe.transform('nope', param(Uuid)));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error).toHaveProperty('response', {
        statusCode: 400,
        error: 'Bad Request',
        message: ['id: must be a UUID (was "nope")'],
      });
    });
  });

  describe('with an explicit type', () => {
    it('checks that type whatever the parameter is declared as', () => {
      expect(new NominalPipe(Email).transform('jane@example.com', param(String))).toBeInstanceOf(
        Email,
      );
    });

    it('lets a custom factory shape the failure', () => {
      const pipe = new NominalPipe(Email, {
        exceptionFactory: (issues) => new RangeError(issues.map((issue) => issue.message).join()),
      });

      expect(() => pipe.transform('nope', param(String))).toThrow(RangeError);
    });

    it('leaves values out of the messages for every type with hideValues', () => {
      const pipe = new NominalPipe({
        hideValues: true,
        exceptionFactory: (issues) => new RangeError(issues.map((issue) => issue.message).join()),
      });

      expect(() => pipe.transform('secret-password-123', param(Uuid))).toThrow(
        new RangeError('must be a UUID (was a string of 19 characters)'),
      );
      expect(thrownBy(() => new NominalPipe().transform('nope', param(Uuid)))).toHaveProperty(
        'response.message',
        ['id: must be a UUID (was "nope")'],
      );
    });

    it('checks against any synchronous Standard Schema, such as an ArkType or Zod object', () => {
      const ark = fromArk(type({ customer: toArk(Email) }));
      const zod = z.object({ customer: toZod(Email) });

      for (const schema of [ark, zod]) {
        const pipe = new NominalPipe(schema);

        expect(pipe.transform({ customer: 'jane@example.com' }, body)).toStrictEqual({
          customer: new Email('jane@example.com'),
        });
        expect(thrownBy(() => pipe.transform({ customer: 'nope' }, body))).toBeInstanceOf(
          BadRequestException,
        );
      }
    });

    it('refuses an asynchronous schema', () => {
      const slow = z.string().refine(() => Promise.resolve(true));

      expect(() => new NominalPipe(slow).transform('x', body)).toThrow(
        new TypeError('NominalPipe: asynchronous schemas are not supported'),
      );
    });

    it('takes options alone when bound globally', () => {
      const pipe = new NominalPipe({ exceptionFactory: () => new RangeError('custom') });

      expect(() => pipe.transform('nope', param(Uuid))).toThrow('custom');
    });
  });

  describe('inside a Nest application', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      const module = await Test.createTestingModule({ controllers: [UsersController] }).compile();
      const fastify = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

      fastify.useGlobalPipes(new NominalPipe());
      await fastify.init();
      await fastify.getHttpAdapter().getInstance().ready();
      app = fastify;
    });

    afterAll(async () => {
      await app.close();
    });

    const get = async (url: string): Promise<{ status: number; body: unknown }> => {
      const response = await app.inject({ method: 'GET', url });

      return { status: response.statusCode, body: response.json() };
    };

    it('hands the handler an instance for a parameter typed as a nominal class', async () => {
      const response = await get(`/users/${id}`);

      expect(response).toStrictEqual({
        status: 200,
        body: { id, isUuid: true, version: 7 },
      });
    });

    it('answers 400 for a value the type rejects', async () => {
      const response = await get('/users/nope');

      expect(response).toStrictEqual({
        status: 400,
        body: {
          statusCode: 400,
          error: 'Bad Request',
          message: ['id: must be a UUID (was "nope")'],
        },
      });
    });

    it('leaves parameters of other types alone', async () => {
      expect(await get('/users/nope/raw')).toStrictEqual({
        status: 200,
        body: { id: 'nope', type: 'string' },
      });
    });

    it('applies a pipe bound to one parameter', async () => {
      expect(await get('/users?email=jane%2Bnews%40example.com')).toStrictEqual({
        status: 200,
        body: { email: 'jane+news@example.com', mailbox: 'jane' },
      });
    });
  });
});
