import 'reflect-metadata';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { ApiProperty, ApiSchema, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { beforeAll, describe, expect, it } from 'vitest';

import { NominalField } from '../../../src/adapters/class-validator/index.ts';
import { ApiNominalProperty, applyNominalTypes } from '../../../src/adapters/swagger/index.ts';
import { AnyString, Email, n, Uuid } from '../../../src/index.ts';
import { nestMajor } from '../nest/support.ts';

class UserId extends Uuid.subtype('UserId') {}

class ManualDto {
  @ApiNominalProperty(Email)
  public contact!: Email;

  @ApiNominalProperty(n.of(Uuid).array({ min: 1, max: 5 }))
  public items!: readonly Uuid[];

  @ApiNominalProperty(n.of(Email).optional())
  public backup?: Email;

  @ApiNominalProperty(Email, { description: 'Where invoices go' })
  public billing!: Email;
}

class ReflectedDto {
  @ApiProperty()
  public contact!: Email;
}

@Controller('users')
class UsersController {
  @Get(':id')
  public find(@Param('id') id: UserId): unknown {
    return id.value;
  }

  @Post('manual')
  public manual(@Body() body: ManualDto): unknown {
    return body;
  }

  @Post('reflected')
  public reflected(@Body() body: ReflectedDto): unknown {
    return body;
  }
}

const documentFor = async (controller: new () => unknown): Promise<OpenAPIObject> => {
  const module = await Test.createTestingModule({ controllers: [controller] }).compile();
  const app = module.createNestApplication(new FastifyAdapter());

  await app.init();
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());

  await app.close();

  return document;
};

const parameterNamed = (document: OpenAPIObject, path: string, name: string): unknown =>
  (document.paths[path]?.get?.parameters ?? []).find(
    (parameter) => 'name' in parameter && parameter.name === name,
  );

const uuidSchema = (title: string): Record<string, unknown> => ({
  title,
  type: 'string',
  pattern: Uuid.pattern.source,
  format: 'uuid',
  minLength: 36,
  maxLength: 36,
  example: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
  description: 'a UUID',
});

const emailSchema = {
  title: 'nominal.Email',
  type: 'string',
  pattern: Email.pattern.source,
  format: 'email',
  minLength: 6,
  maxLength: 254,
  example: 'jane.doe@example.com',
  description: 'an email address',
};

describe('applyNominalTypes', () => {
  let raw: OpenAPIObject;
  let document: OpenAPIObject;

  beforeAll(async () => {
    raw = await documentFor(UsersController);
    document = applyNominalTypes(raw);
  });

  it('leaves the empty schemas @nestjs/swagger makes for nominal classes', () => {
    expect(raw.components?.schemas?.['UserId']).toStrictEqual({ type: 'object', properties: {} });
  });

  it('fills a reflected route parameter type, under the subtype name', () => {
    expect(document.components?.schemas?.['UserId']).toStrictEqual(uuidSchema('UserId'));
  });

  it('fills a nominal type used as a reflected DTO property', () => {
    expect(document.components?.schemas?.['Email']).toStrictEqual(emailSchema);
    expect(document.components?.schemas?.['ReflectedDto']).toMatchObject({
      properties: { contact: { $ref: '#/components/schemas/Email' } },
    });
  });

  it("doesn't change the document it was given", () => {
    expect(raw.components?.schemas?.['Email']).toStrictEqual({ type: 'object', properties: {} });
  });

  it('finds a built-in type by its short name when a type of yours has the same last part', () => {
    AnyString.subtype('swaggerdup.Email', /^.+@.+$/u);
    const empty = { type: 'object', properties: {} };
    const schemas = applyNominalTypes({
      components: { schemas: { Email: empty, 'swaggerdup.Email': empty } },
    }).components?.schemas;

    expect(schemas?.['Email']).toMatchObject({ title: 'nominal.Email', format: 'email' });
    expect(schemas?.['swaggerdup.Email']).toMatchObject({ title: 'swaggerdup.Email' });
    expect(
      applyNominalTypes({ components: { schemas: { Email: empty } } }).components?.schemas,
    ).toStrictEqual({ Email: empty });
  });

  it('leaves schemas with properties and documents without schemas alone', () => {
    const dto = { type: 'object', properties: { id: { type: 'string' } } };

    expect(
      applyNominalTypes({ components: { schemas: { Email: dto } } }).components?.schemas,
    ).toStrictEqual({
      Email: dto,
    });
    const bare = { openapi: '3.0.0' };

    expect(applyNominalTypes(bare)).toStrictEqual(bare);
    expect(
      applyNominalTypes({
        components: { schemas: { Unknown: { type: 'object', properties: {} } } },
      }),
    ).toStrictEqual({
      components: { schemas: { Unknown: { type: 'object', properties: {} } } },
    });
  });
});

describe('ApiNominalProperty', () => {
  let schema: unknown;

  beforeAll(async () => {
    schema = (await documentFor(UsersController)).components?.schemas?.['ManualDto'];
  });

  it('writes the whole schema of a type into the property', () => {
    expect(schema).toMatchObject({ properties: { contact: emailSchema } });
  });

  it('writes lists with their items and bounds', () => {
    expect(schema).toMatchObject({
      properties: {
        items: { type: 'array', minItems: 1, maxItems: 5, items: uuidSchema('nominal.Uuid') },
      },
    });
  });

  it('marks properties required unless the schema is optional', () => {
    expect(schema).toMatchObject({ required: ['contact', 'items', 'billing'] });
  });

  it('lets @ApiProperty options win', () => {
    expect(schema).toMatchObject({ properties: { billing: { description: 'Where invoices go' } } });
  });

  it.each([String, {}, null])('refuses %o', (target) => {
    expect(() => {
      Reflect.apply(ApiNominalProperty, undefined, [target]);
    }).toThrow(TypeError);
  });
});

describe.runIf(nestMajor >= 12)('the Nest 12 schema option', () => {
  it('describes a n.of() schema inline and a class through applyNominalTypes', async () => {
    @Controller('search')
    class SearchController {
      @Get()
      public search(
        @Query('ids', { schema: n.of(Uuid).array({ max: 5 }) }) ids: readonly Uuid[],
        @Query('owner', { schema: UserId }) owner: UserId,
      ): unknown {
        return [ids, owner];
      }
    }
    const document = applyNominalTypes(await documentFor(SearchController));

    expect(parameterNamed(document, '/search', 'ids')).toMatchObject({
      schema: { type: 'array', maxItems: 5 },
    });
    expect(parameterNamed(document, '/search', 'owner')).toMatchObject({
      schema: { $ref: '#/components/schemas/UserId' },
    });
    expect(document.components?.schemas?.['UserId']).toStrictEqual(uuidSchema('UserId'));
  });
});

describe('ApiNominalProperty next to NominalField', () => {
  class SignupDto {
    @NominalField(Email)
    @ApiNominalProperty(Email)
    public email!: Email;
  }

  @Controller('signup')
  class SignupController {
    @Post()
    public create(@Body() body: SignupDto): unknown {
      return body;
    }
  }

  it('documents the property and still validates it', async () => {
    const document = await documentFor(SignupController);

    expect(document.components?.schemas?.['SignupDto']).toMatchObject({
      properties: { email: emailSchema },
      required: ['email'],
    });
    expect(validateSync(plainToInstance(SignupDto, { email: 'nope' }))).toHaveLength(1);
    expect(plainToInstance(SignupDto, { email: 'jane@example.com' }).email).toBeInstanceOf(Email);
  });
});

describe('a class named differently from its type', () => {
  it('is found through @ApiSchema', async () => {
    @ApiSchema({ name: 'MailboxAddress' })
    class Mailbox extends AnyString.subtype('MailboxAddress', /^[a-z]+@example\.com$/u) {}

    @Controller('mailboxes')
    class MailboxesController {
      @Get(':address')
      public find(@Param('address') address: Mailbox): unknown {
        return address.value;
      }
    }
    const schemas = applyNominalTypes(await documentFor(MailboxesController)).components?.schemas;

    expect(schemas?.['MailboxAddress']).toMatchObject({ title: 'MailboxAddress', type: 'string' });
    expect(schemas).not.toHaveProperty('Mailbox');
  });
});
