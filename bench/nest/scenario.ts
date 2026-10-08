import 'reflect-metadata';
import {
  Body,
  Controller,
  Post,
  StandardSchemaValidationPipe,
  ValidationPipe,
} from '@nestjs/common';
import type { PipeTransform, Type as Class } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { Type } from 'class-transformer';
import { IsInt, IsString, MinLength, ValidateNested } from 'class-validator';

import { buildDocument, withManyErrors, withOneError } from '../document/data.ts';
import { DocumentDto } from './class-validator-dtos.ts';
import { NominalDocumentDto } from './nominal-dtos.ts';
import {
  arkType,
  nominalWithArkAdapter,
  nominalObjectOf,
  nominalWithArkType,
  valibotDocument,
  zodDocument,
} from './schemas.ts';

const [setup = '', unrelated = '0', typiaPath = ''] = process.argv.slice(2);

const registerUnrelatedDtos = (count: number): void => {
  for (let index = 0; index < count; index += 1) {
    class Unrelated {}

    for (const property of ['a', 'b', 'c', 'd']) {
      IsString()(Unrelated.prototype, property);
      MinLength(1)(Unrelated.prototype, property);
      IsInt()(Unrelated.prototype, `${property}Count`);
    }

    ValidateNested()(Unrelated.prototype, 'child');
    Type(() => Unrelated)(Unrelated.prototype, 'child');
  }
};

const dtoController = (dto: Class): Class => {
  @Controller()
  class DocumentsController {
    @Post()
    public create(@Body() document: unknown): string {
      return document === undefined ? 'missing' : 'ok';
    }
  }

  Reflect.defineMetadata('design:paramtypes', [dto], DocumentsController.prototype, 'create');

  return DocumentsController;
};

const isStandardSchema = (value: unknown): value is StandardSchemaV1 =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  '~standard' in value;

const schemaController = (schema: StandardSchemaV1): Class => {
  @Controller()
  class DocumentsController {
    @Post()
    public create(@Body({ schema }) document: unknown): string {
      return document === undefined ? 'missing' : 'ok';
    }
  }

  return DocumentsController;
};

const setupOf = async (name: string): Promise<{ controller: Class; pipe: PipeTransform }> => {
  const validation = new ValidationPipe({ transform: true });
  const standard = new StandardSchemaValidationPipe();

  switch (name) {
    case 'class-validator':
      return { controller: dtoController(DocumentDto), pipe: validation };
    case 'nominal-types + class-validator':
      return { controller: dtoController(NominalDocumentDto), pipe: validation };
    case 'nominal-types objectOf()':
      return { controller: schemaController(nominalObjectOf), pipe: standard };
    case 'nominal-types + ArkType adapter':
      return { controller: schemaController(nominalWithArkAdapter), pipe: standard };
    case 'nominal-types + ArkType, schemaOf()':
      return { controller: schemaController(nominalWithArkType), pipe: standard };
    case 'arktype':
      return { controller: schemaController(arkType), pipe: standard };
    case 'zod':
      return { controller: schemaController(zodDocument), pipe: standard };
    case 'valibot':
      return { controller: schemaController(valibotDocument), pipe: standard };

    case 'typia': {
      const typia: unknown = await import(typiaPath);
      const validateDocument: unknown =
        typeof typia === 'object' && typia !== null
          ? Reflect.get(typia, 'validateDocument')
          : undefined;

      if (!isStandardSchema(validateDocument)) {
        throw new Error('typia validators are missing; run npm run bench:typia');
      }

      return { controller: schemaController(validateDocument), pipe: standard };
    }

    default:
      throw new Error(`unknown setup ${name}`);
  }
};

registerUnrelatedDtos(Number(unrelated));

const { controller, pipe } = await setupOf(setup);
const module = await Test.createTestingModule({ controllers: [controller] }).compile();
const app = module.createNestApplication<NestFastifyApplication>(
  new FastifyAdapter({ bodyLimit: 32 * 1024 * 1024 }),
  { logger: false },
);

app.useGlobalPipes(pipe);
await app.init();
await app.getHttpAdapter().getInstance().ready();

const valid = buildDocument();
const payloads: ReadonlyArray<readonly [string, string, number]> = [
  ['valid', JSON.stringify(valid), 201],
  ['oneError', JSON.stringify(withOneError(valid)), 400],
  ['manyErrors', JSON.stringify(withManyErrors(valid)), 400],
];

const send = async (payload: string): Promise<number> => {
  const response = await app.inject({
    method: 'POST',
    url: '/',
    headers: { 'content-type': 'application/json' },
    payload,
  });

  return response.statusCode;
};

const results: Record<string, number> = {};

for (const [name, payload, status] of payloads) {
  const answered = await send(payload);

  if (answered !== status) {
    throw new Error(`${setup} answered ${answered} instead of ${status} for ${name}`);
  }

  for (let warmUp = 0; warmUp < 3; warmUp += 1) {
    await send(payload);
  }

  const times: number[] = [];

  for (let run = 0; run < 9; run += 1) {
    const started = performance.now();

    await send(payload);
    times.push(performance.now() - started);
  }

  times.sort((left, right) => left - right);
  results[name] = times[4] ?? Number.NaN;
}

await app.close();
process.stdout.write(`${JSON.stringify(results)}\n`);
