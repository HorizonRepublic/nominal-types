import 'reflect-metadata';
import { createServer } from 'node:net';

import { Controller } from '@nestjs/common';
import type { INestMicroservice } from '@nestjs/common';
import {
  ClientProxyFactory,
  MessagePattern,
  Payload,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import type { ClientProxy } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NominalPipe } from '../../../src/adapters/nest/index.ts';
import { Uuid } from '../../../src/index.ts';
import { first } from './support.ts';

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      server.close(() => {
        if (typeof address === 'object' && address !== null) {
          resolve(address.port);
        } else {
          reject(new Error('no port was assigned'));
        }
      });
    });
  });

@Controller()
class UsersHandler {
  @MessagePattern('user.find')
  public find(
    @Payload(new NominalPipe(Uuid, { exceptionFactory: (issues) => new RpcException({ issues }) }))
    id: Uuid,
  ): unknown {
    return { id: id.value, version: id.version, isUuid: id instanceof Uuid };
  }

  @MessagePattern('user.find-default')
  public findDefault(@Payload(new NominalPipe(Uuid)) id: Uuid): unknown {
    return { id: id.value };
  }
}

describe('NominalPipe in a microservice', () => {
  let service: INestMicroservice;
  let client: ClientProxy;

  beforeAll(async () => {
    const port = await freePort();
    const module = await Test.createTestingModule({ controllers: [UsersHandler] }).compile();

    service = module.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port },
    });
    await service.listen();
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await service.close();
  });

  const send = async (pattern: string, data: unknown): Promise<unknown> => {
    try {
      return await firstValueFrom(client.send(pattern, data));
    } catch (error) {
      return { error };
    }
  };

  it('hands the handler an instance', async () => {
    expect(await send('user.find', first)).toStrictEqual({ id: first, version: 7, isUuid: true });
  });

  it('answers with the issues through an RpcException', async () => {
    expect(await send('user.find', 'nope')).toStrictEqual({
      error: { issues: [{ message: 'must be a UUID (was "nope")' }] },
    });
  });

  it('hides a BadRequestException behind a generic error, as Nest does for every HTTP exception', async () => {
    expect(await send('user.find-default', 'nope')).toStrictEqual({
      error: { status: 'error', message: 'Internal server error' },
    });
  });
});
