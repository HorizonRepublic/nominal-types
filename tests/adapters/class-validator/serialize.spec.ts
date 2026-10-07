import 'reflect-metadata';
import { ClassSerializerInterceptor, Controller, Get } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { instanceToPlain, plainToInstance, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NominalField } from '../../../src/adapters/class-validator/index.ts';
import { AnyBigInt, Email, Nominal, schemaOf, Uuid } from '../../../src/index.ts';

const first = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

class Pair extends Nominal('SerializedPair', schemaOf(Uuid).array({ length: 2 })) {}

class AddressDto {
  @NominalField(Email)
  public email!: Email;
}

class AccountDto {
  @NominalField(Email)
  public contact!: Email;

  @NominalField(schemaOf(Uuid).array())
  public teams!: readonly Uuid[];

  @NominalField(AnyBigInt)
  public balance!: AnyBigInt;

  @NominalField(Pair)
  public pair!: Pair;

  @NominalField(schemaOf(Email).optional())
  public backup?: Email;

  @ValidateNested()
  @Type(() => AddressDto)
  public billing!: AddressDto;
}

const plain = {
  contact: 'jane@example.com',
  teams: [first],
  balance: '9007199254740993',
  pair: [first, first],
  billing: { email: 'bill@example.com' },
};

describe('instanceToPlain with NominalField', () => {
  it('gives back the values the DTO was built from', () => {
    const account = plainToInstance(AccountDto, plain);

    expect(account.contact).toBeInstanceOf(Email);
    expect(instanceToPlain(account)).toStrictEqual({ ...plain, backup: undefined });
  });

  it('writes a set optional property as its value', () => {
    expect(
      instanceToPlain(plainToInstance(AccountDto, { ...plain, backup: 'b@example.com' })),
    ).toMatchObject({
      backup: 'b@example.com',
    });
  });
});

describe('ClassSerializerInterceptor', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    @Controller('accounts')
    class AccountsController {
      @Get()
      public find(): AccountDto {
        return plainToInstance(AccountDto, plain);
      }
    }
    const module = await Test.createTestingModule({ controllers: [AccountsController] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get('Reflector')));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers with plain values, not { value } objects', async () => {
    expect((await app.inject({ method: 'GET', url: '/accounts' })).json()).toStrictEqual(plain);
  });
});
