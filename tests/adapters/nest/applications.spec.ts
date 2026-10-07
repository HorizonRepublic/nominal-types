import 'reflect-metadata';
import { Controller, Get, Param, Query } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NominalPipe } from '../../../src/adapters/nest/index.ts';
import { AnyBoolean, Email, PositiveInteger, schemaOf, Uuid } from '../../../src/index.ts';
import { badRequest, describeIds, first, nestMajor, request, second, start } from './support.ts';

@Controller('explicit')
class ExplicitController {
  @Get('ids')
  public ids(
    @Query('ids', new NominalPipe(schemaOf(Uuid).array({ max: 3 }))) ids: readonly Uuid[],
  ): unknown {
    return { ids: describeIds(ids), frozen: Object.isFrozen(ids) };
  }

  @Get('optional-ids')
  public optionalIds(
    @Query('ids', new NominalPipe(schemaOf(Uuid).array().optional())) ids?: readonly Uuid[],
  ): unknown {
    return { ids: describeIds(ids) };
  }

  @Get('email')
  public email(
    @Query('email', new NominalPipe(schemaOf(Email).optional())) email?: Email,
  ): unknown {
    return { email: email === undefined ? 'none' : email.domain };
  }

  @Get('pages')
  public pages(
    @Query('pages', new NominalPipe(schemaOf(PositiveInteger).fromString().array()))
    pages: readonly PositiveInteger[],
  ): unknown {
    return { pages: pages.map((page) => page.value) };
  }
}

describe('explicit pipes on parameters', () => {
  let app: NestFastifyApplication;
  const get = request(() => app);

  beforeAll(async () => {
    app = await start(ExplicitController, []);
  });

  afterAll(async () => {
    await app.close();
  });

  it('checks every value of a repeated query parameter', async () => {
    expect(await get(`/explicit/ids?ids=${first}&ids=${second}`)).toStrictEqual({
      status: 200,
      body: {
        ids: [
          { id: first, isUuid: true },
          { id: second, isUuid: true },
        ],
        frozen: true,
      },
    });
  });

  it('treats a single value as a list of one', async () => {
    expect(await get(`/explicit/ids?ids=${first}`)).toStrictEqual({
      status: 200,
      body: { ids: [{ id: first, isUuid: true }], frozen: true },
    });
  });

  it('reports a bad item with its index', async () => {
    expect(await get(`/explicit/ids?ids=${first}&ids=nope`)).toStrictEqual(
      badRequest('ids.1: must be a UUID (was "nope")'),
    );
  });

  it('rejects a list that is too long before checking items', async () => {
    expect(await get('/explicit/ids?ids=a&ids=b&ids=c&ids=d')).toStrictEqual(
      badRequest('ids: must have at most 3 items (was 4)'),
    );
  });

  it('rejects a missing value without optional()', async () => {
    expect((await get('/explicit/ids')).status).toBe(400);
  });

  it('lets a missing optional list or value through', async () => {
    expect(await get('/explicit/optional-ids')).toStrictEqual({
      status: 200,
      body: { ids: 'none' },
    });
    expect(await get('/explicit/email')).toStrictEqual({ status: 200, body: { email: 'none' } });
    expect(await get('/explicit/email?email=jane@example.com')).toStrictEqual({
      status: 200,
      body: { email: 'example.com' },
    });
  });

  it('reads every item of a list of numbers', async () => {
    expect(await get('/explicit/pages?pages=1&pages=2')).toStrictEqual({
      status: 200,
      body: { pages: [1, 2] },
    });
    expect(await get('/explicit/pages?pages=1&pages=x')).toStrictEqual(
      badRequest('pages.1: must be a number (was "x")'),
    );
  });
});

@Controller('global')
class GlobalController {
  @Get('page')
  public page(@Query('page') page: PositiveInteger): unknown {
    return { page: page.value, isPositive: page instanceof PositiveInteger };
  }

  @Get('flag')
  public flag(@Query('active') active: AnyBoolean): unknown {
    return { active: active.value, isBoolean: active instanceof AnyBoolean };
  }

  @Get('items/:position')
  public item(@Param('position') position: PositiveInteger): unknown {
    return { position: position.value };
  }

  @Get('unchecked')
  public unchecked(@Query('ids') ids: Uuid[]): unknown {
    return { types: ids.map((id) => typeof id) };
  }
}

describe('a global pipe', () => {
  let app: NestFastifyApplication;
  const get = request(() => app);

  beforeAll(async () => {
    app = await start(GlobalController, [new NominalPipe()]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reads numbers from a query string', async () => {
    expect(await get('/global/page?page=2')).toStrictEqual({
      status: 200,
      body: { page: 2, isPositive: true },
    });
  });

  it.each([
    ['0', 'page: must be a positive integer (was 0)'],
    ['abc', 'page: must be a number (was "abc")'],
    ['02', 'page: must be a number (was "02")'],
    ['', 'page: must be a number (was "")'],
    ['1.5', 'page: must be a safe integer (was 1.5)'],
  ])('rejects ?page=%s', async (page, message) => {
    expect(await get(`/global/page?page=${page}`)).toStrictEqual(badRequest(message));
  });

  it('reads booleans and route parameters', async () => {
    expect(await get('/global/flag?active=false')).toStrictEqual({
      status: 200,
      body: { active: false, isBoolean: true },
    });
    expect(await get('/global/flag?active=1')).toStrictEqual(
      badRequest('active: must be a boolean (was "1")'),
    );
    expect(await get('/global/items/3')).toStrictEqual({ status: 200, body: { position: 3 } });
  });

  it('leaves an array declared without a schema unchecked', async () => {
    expect(await get('/global/unchecked?ids=nope&ids=nope')).toStrictEqual({
      status: 200,
      body: { types: ['string', 'string'] },
    });
  });
});

describe.runIf(nestMajor >= 12)('a global pipe with the Nest 12 schema option', () => {
  let app: NestFastifyApplication;
  const get = request(() => app);

  beforeAll(async () => {
    @Controller('declared')
    class DeclaredController {
      @Get('ids')
      public ids(@Query('ids', { schema: schemaOf(Uuid).array() }) ids: readonly Uuid[]): unknown {
        return { ids: describeIds(ids) };
      }

      @Get('email')
      public email(@Query('email', { schema: schemaOf(Email).optional() }) email?: Email): unknown {
        return { email: email === undefined ? 'none' : email.domain };
      }
    }
    app = await start(DeclaredController, [new NominalPipe()]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reads the schema from the parameter, with no pipe on it', async () => {
    expect(await get(`/declared/ids?ids=${first}`)).toStrictEqual({
      status: 200,
      body: { ids: [{ id: first, isUuid: true }] },
    });
    expect((await get('/declared/ids?ids=nope')).status).toBe(400);
  });

  it('lets a missing optional value through', async () => {
    expect(await get('/declared/email')).toStrictEqual({ status: 200, body: { email: 'none' } });
  });
});
