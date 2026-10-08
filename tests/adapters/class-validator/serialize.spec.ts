import 'reflect-metadata';
import { ClassSerializerInterceptor, Controller, Get } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { instanceToPlain, plainToInstance, Type } from 'class-transformer';
import { ValidateNested, validateSync } from 'class-validator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NominalField } from '../../../src/adapters/class-validator/index.ts';
import { AnyBigInt, Email, n, Nominal, Uuid } from '../../../src/index.ts';

const first = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

class Pair extends Nominal('SerializedPair', n.of(Uuid).array({ length: 2 })) {}

class AddressDto {
  @NominalField(Email)
  public email!: Email;
}

class AccountDto {
  @NominalField(Email)
  public contact!: Email;

  @NominalField(n.of(Uuid).array())
  public teams!: readonly Uuid[];

  @NominalField(AnyBigInt)
  public balance!: AnyBigInt;

  @NominalField(Pair)
  public pair!: Pair;

  @NominalField(n.of(Email).optional())
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

describe('the serialize option', () => {
  class ContactDto {
    @NominalField(Email, { serialize: (email) => email.canonical().value })
    public email!: Email;

    @NominalField(n.of(Uuid).array(), {
      serialize: (ids) => ids.map((id) => id.canonical().value),
    })
    public teams!: readonly Uuid[];

    @NominalField(n.of(Email).optional(), { serialize: (email) => email.domain })
    public backup?: Email;

    @NominalField(Email, {
      serialize: (email) => ({ mailbox: email.mailbox, domain: email.domain }),
    })
    public owner!: Email;
  }

  const contact = {
    email: 'Jane.Doe+news@Example.com',
    teams: [first.toUpperCase()],
    owner: 'john@example.com',
  };

  it('writes what serialize makes of each value', () => {
    expect(
      instanceToPlain(plainToInstance(ContactDto, { ...contact, backup: 'b@backup.io' })),
    ).toStrictEqual({
      email: 'jane.doe@example.com',
      teams: [first],
      backup: 'backup.io',
      owner: { mailbox: 'john', domain: 'example.com' },
    });
  });

  it("doesn't call serialize for a missing value", () => {
    expect(instanceToPlain(plainToInstance(ContactDto, contact))['backup']).toBeUndefined();
  });

  it('serializes a raw value put into the property by hand', () => {
    const dto = Object.assign(new ContactDto(), {
      email: 'Jane@Example.com',
      teams: [],
      owner: 'x@y.co',
    });

    expect(instanceToPlain(dto)).toMatchObject({ email: 'jane@example.com' });
  });

  it('leaves a value serialize would reject to its plain form', () => {
    const dto = Object.assign(new ContactDto(), {
      email: 'not an email',
      teams: [],
      owner: 'x@y.co',
    });

    expect(instanceToPlain(dto)).toMatchObject({ email: 'not an email' });
  });

  it('leaves JSON.stringify writing the value itself', () => {
    expect(JSON.parse(JSON.stringify(plainToInstance(ContactDto, contact)))).toMatchObject({
      email: 'Jane.Doe+news@Example.com',
    });
  });

  it('still passes class-validator options through', () => {
    class MessageDto {
      @NominalField(Email, { message: 'a real address, please', serialize: (email) => email.value })
      public email!: Email;
    }

    expect(validateSync(plainToInstance(MessageDto, { email: 'x' }))).toMatchObject([
      { constraints: { nominalField: 'a real address, please' } },
    ]);
  });
});
