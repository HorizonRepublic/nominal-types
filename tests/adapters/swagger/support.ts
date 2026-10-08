import 'reflect-metadata';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import { Email, Uuid } from '../../../src/index.ts';

export const documentFor = async (controller: new () => unknown): Promise<OpenAPIObject> => {
  const module = await Test.createTestingModule({ controllers: [controller] }).compile();
  const app = module.createNestApplication(new FastifyAdapter());

  await app.init();
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());

  await app.close();

  return document;
};

export const parameterNamed = (document: OpenAPIObject, path: string, name: string): unknown =>
  (document.paths[path]?.get?.parameters ?? []).find(
    (parameter) => 'name' in parameter && parameter.name === name,
  );

export const uuidSchema = (title: string): Record<string, unknown> => ({
  title,
  type: 'string',
  pattern: Uuid.pattern.source,
  format: 'uuid',
  minLength: 36,
  maxLength: 36,
  example: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
  description: 'a UUID',
});

export const emailSchema = {
  title: 'nominal.Email',
  type: 'string',
  pattern: Email.pattern.source.replace('(?=.{6,254}$)(?=[^@]{1,64}@)', ''),
  format: 'email',
  minLength: 6,
  maxLength: 254,
  not: { pattern: '^[^@]{65}' },
  example: 'jane.doe@example.com',
  description: 'an email address',
};
