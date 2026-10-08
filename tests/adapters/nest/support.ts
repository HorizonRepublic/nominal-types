import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import type { ArgumentMetadata, INestApplication, PipeTransform, Type } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { Uuid } from '../../../src/index.ts';

export const first = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';
export const second = '6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718';

const isNestPackage = (value: unknown): value is { version: string } =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'version') === 'string';
const nestPackage: unknown = JSON.parse(
  readFileSync(
    join(dirname(createRequire(import.meta.url).resolve('@nestjs/common')), 'package.json'),
    'utf8',
  ),
);

export const nestMajor = isNestPackage(nestPackage) ? Number(nestPackage.version.split('.')[0]) : 0;

export const argument = (
  type: ArgumentMetadata['type'],
  extra: Partial<ArgumentMetadata> = {},
): ArgumentMetadata => ({
  type,
  data: 'value',
  ...extra,
});

export const describeIds = (ids: readonly Uuid[] | undefined): unknown =>
  ids === undefined ? 'none' : ids.map((id) => ({ id: id.value, isUuid: id instanceof Uuid }));

/**
 * The HTTP platforms the application tests run on.
 */
export const platforms: readonly Platform[] = ['fastify', 'express'];

export type Platform = 'fastify' | 'express';

export interface Started {
  readonly app: INestApplication;
  readonly get: (path: string) => Promise<{ status: number; body: unknown }>;
  readonly post: (path: string, body: unknown) => Promise<{ status: number; body: unknown }>;
}

export const start = async (
  controller: Type,
  globalPipes: readonly PipeTransform[],
  platform: Platform = 'fastify',
): Promise<Started> => {
  const module = await Test.createTestingModule({ controllers: [controller] }).compile();
  const app =
    platform === 'fastify'
      ? module.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
      : module.createNestApplication(new ExpressAdapter());

  app.useGlobalPipes(...globalPipes);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();

  return {
    app,
    get: async (path) => {
      const response = await fetch(`${base}${path}`);

      return { status: response.status, body: await response.json() };
    },
    post: async (path, body) => {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      return { status: response.status, body: await response.json() };
    },
  };
};

export const badRequest = (message: string): { status: number; body: unknown } => ({
  status: 400,
  body: { statusCode: 400, error: 'Bad Request', message: [message] },
});
