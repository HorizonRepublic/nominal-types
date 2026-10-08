import 'reflect-metadata';
import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  SerializeOptions,
  StreamableFile,
} from '@nestjs/common';
import type { INestApplication, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import * as classTransformer from 'class-transformer';
import { Exclude, Expose } from 'class-transformer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NominalField } from '../../../src/adapters/class-validator/index.ts';
import { NominalSerializerInterceptor } from '../../../src/adapters/nest/index.ts';
import { AnyString, Email, Nominal, n, PositiveInteger, Uuid } from '../../../src/index.ts';
import { first, platforms } from './support.ts';
import type { Platform } from './support.ts';

class Money extends Nominal('serializer.Money', n.object({ amount: PositiveInteger })) {}

class User {
  public readonly id: Uuid;
  public readonly email: Email;

  @Exclude()
  public readonly password: AnyString;

  public constructor(id: Uuid, email: Email) {
    this.id = id;
    this.email = email;
    this.password = new AnyString('secret');
  }

  @Expose()
  public get kind(): string {
    return 'user';
  }
}

class UserView {
  @NominalField(Email, { serialize: (email) => email.domain })
  public email!: Email;

  @Exclude()
  public internal?: string;
}

const user = (): User => new User(new Uuid(first), new Email('jane@example.com'));

@Controller('serialized')
class SerializedController {
  @Get('user')
  public user(): User {
    return user();
  }

  @Get('users')
  public users(): User[] {
    return [user(), user()];
  }

  @Get('nested')
  public nested(): unknown {
    return {
      owner: { contact: new Email('jane@example.com'), pages: [new PositiveInteger(1)] },
      price: new Money({ amount: 3 }),
      missing: null,
    };
  }

  @Get('instance')
  public instance(): Email {
    return new Email('jane@example.com');
  }

  @Get('typed')
  @SerializeOptions({ type: UserView })
  public typed(): unknown {
    return { email: new Email('jane@example.com'), internal: 'hidden' };
  }
}

const serve = async (
  platform: Platform,
  interceptor: (app: INestApplication) => NestInterceptor,
): Promise<{ app: INestApplication; get: (path: string) => Promise<unknown> }> => {
  const module = await Test.createTestingModule({ controllers: [SerializedController] }).compile();
  const app = module.createNestApplication(
    platform === 'fastify' ? new FastifyAdapter() : new ExpressAdapter(),
  );

  app.useGlobalInterceptors(interceptor(app));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();

  return {
    app,
    get: async (path) => {
      const response = await fetch(`${base}${path}`);
      const text = await response.text();
      const isJson = response.headers.get('content-type')?.includes('json') === true;
      const body: unknown = isJson ? JSON.parse(text) : text;

      return body;
    },
  };
};

describe.each(platforms)('NominalSerializerInterceptor on %s', (platform) => {
  let served: Awaited<ReturnType<typeof serve>>;

  beforeAll(async () => {
    served = await serve(platform, (app) => new NominalSerializerInterceptor(app.get(Reflector)));
  });

  afterAll(async () => {
    await served.app.close();
  });

  it('writes the instances of a class as their values and still applies @Exclude', async () => {
    expect(await served.get('/serialized/user')).toStrictEqual({
      id: first,
      email: 'jane@example.com',
      kind: 'user',
    });
  });

  it('writes every item of a list', async () => {
    expect(await served.get('/serialized/users')).toStrictEqual([
      { id: first, email: 'jane@example.com', kind: 'user' },
      { id: first, email: 'jane@example.com', kind: 'user' },
    ]);
  });

  it('writes instances deep in plain objects and lists, and object values', async () => {
    expect(await served.get('/serialized/nested')).toStrictEqual({
      owner: { contact: 'jane@example.com', pages: [1] },
      price: { amount: 3 },
      missing: null,
    });
  });

  it('writes a response that is one instance as its value', async () => {
    expect(await served.get('/serialized/instance')).toBe('jane@example.com');
  });

  it('keeps @SerializeOptions types and the serialize option of @NominalField', async () => {
    expect(await served.get('/serialized/typed')).toStrictEqual({ email: 'example.com' });
  });
});

describe('ClassSerializerInterceptor without nominal instances turned into values', () => {
  let served: Awaited<ReturnType<typeof serve>>;

  beforeAll(async () => {
    served = await serve('fastify', (app) => new ClassSerializerInterceptor(app.get(Reflector)));
  });

  afterAll(async () => {
    await served.app.close();
  });

  it('writes an instance as an object with a value', async () => {
    expect(await served.get('/serialized/user')).toStrictEqual({
      id: { value: first },
      email: { value: 'jane@example.com' },
      kind: 'user',
    });
  });
});

describe('NominalSerializerInterceptor.serialize', () => {
  const interceptor = new NominalSerializerInterceptor(new Reflector(), {
    transformerPackage: classTransformer,
  });

  it("doesn't change the response it was given", () => {
    const response = { contact: new Email('jane@example.com'), list: [new Uuid(first)] };

    expect(interceptor.serialize(response, {})).toStrictEqual({
      contact: 'jane@example.com',
      list: [first],
    });
    expect(response.contact).toBeInstanceOf(Email);
    expect(response.list[0]).toBeInstanceOf(Uuid);
  });

  it('keeps the class of an object that holds an instance, and leaves the object as it was', () => {
    const held = user();

    expect(interceptor.serialize(held, {})).toStrictEqual({
      id: first,
      email: 'jane@example.com',
      kind: 'user',
    });
    expect(held.email).toBeInstanceOf(Email);
    expect(held.password).toBeInstanceOf(AnyString);
  });

  it('gives what class-transformer gives for a response without instances', () => {
    expect(interceptor.serialize([{ name: 'jane', tags: ['a'] }], {})).toStrictEqual([
      { name: 'jane', tags: ['a'] },
    ]);
  });

  it('follows a response that refers to itself', () => {
    const looped: Record<string, unknown> = { contact: new Email('jane@example.com') };

    looped['self'] = looped;
    const serialized = interceptor.serialize(looped, { enableCircularCheck: true });

    expect(Reflect.get(serialized, 'contact')).toBe('jane@example.com');
  });

  it('leaves dates, files and values that are not objects alone', () => {
    const date = new Date(0);
    const file = new StreamableFile(Buffer.from('x'));

    expect(interceptor.serialize({ date }, {})).toStrictEqual({ date });
    expect(interceptor.serialize(file, {})).toBe(file);
  });
});
