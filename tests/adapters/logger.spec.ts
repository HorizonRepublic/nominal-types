import { Writable } from 'node:stream';

import { Logger as NestLogger } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { fastifyNominal } from '../../src/adapters/fastify/index.ts';
import { toGraphQL } from '../../src/adapters/graphql/index.ts';
import { nestLogger, NominalPipe } from '../../src/adapters/nest/index.ts';
import type { Configuration } from '../../src/index.ts';
import { n, Nominal, pinoLogger, Uuid } from '../../src/index.ts';
import { resetConfigurationAfterEach } from '../support/configuration.ts';

const secret = 'hunter2-hunter2';

class Password extends Nominal('logged.Password', /^.{20,}$/u, { sensitive: true }) {}

type Method = (message: string, details?: Record<string, unknown>) => void;

const debugLogger = (): { readonly warn: Mock<Method>; readonly debug: Mock<Method> } => ({
  warn: vi.fn<Method>(),
  debug: vi.fn<Method>(),
});

const quietly = (run: () => unknown): void => {
  try {
    run();
  } catch {
    // The rejection is not what these tests look at.
  }
};

resetConfigurationAfterEach();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('debug entries for rejected values', () => {
  it('reports what NominalPipe rejects, with the codes and paths of the issues', () => {
    const logger = debugLogger();

    n.configure({ logger, codes: true });
    quietly(() =>
      new NominalPipe(n.object({ id: Uuid })).transform(
        { id: 'nope' },
        { type: 'body', data: undefined },
      ),
    );

    expect(logger.debug).toHaveBeenCalledExactlyOnceWith('NominalPipe rejected a route argument', {
      argument: 'body',
      name: undefined,
      issues: [{ code: 'pattern', path: ['id'], message: 'must be a UUID (was "nope")' }],
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('reports what the GraphQL scalar rejects', () => {
    const logger = debugLogger();

    n.configure({ logger });
    // oxlint-disable-next-line typescript/no-deprecated
    quietly(() => toGraphQL(Uuid).parseValue('nope'));

    expect(logger.debug).toHaveBeenCalledExactlyOnceWith('toGraphQL rejected a scalar value', {
      scalar: 'Uuid',
      issues: [{ message: 'must be a UUID (was "nope")' }],
    });
  });

  it('writes to a real pino logger through pinoLogger(), as Fastify gives it', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write: (chunk: Buffer, _encoding, done): void => {
        lines.push(chunk.toString());
        done();
      },
    });
    const app = Fastify({ logger: { level: 'debug', stream } });

    await app.register(fastifyNominal);
    app.get('/orders/:id', { schema: { params: n.object({ id: Uuid }) } }, () => 'ok');
    n.configure({ logger: pinoLogger(app.log) });

    const response = await app.inject({ method: 'GET', url: '/orders/nope' });

    expect(response.statusCode).toBe(400);
    expect(lines.map((line): unknown => JSON.parse(line))).toContainEqual(
      expect.objectContaining({
        level: 20,
        msg: 'fastifyNominal rejected a request',
        route: 'GET /orders/:id',
        part: 'params',
        issues: [{ path: ['id'], message: 'must be a UUID (was "nope")' }],
      }),
    );
  });

  it.each<[string, Configuration, boolean]>([
    ["values: 'hide'", { values: 'hide' }, false],
    ["values: 'length'", { values: 'length' }, false],
    ['hideValues on the pipe', {}, true],
  ])('leaves the value out with %s', (_, options, hideValues) => {
    const logger = debugLogger();

    n.configure({ logger, ...options });
    quietly(() =>
      new NominalPipe(Uuid, { hideValues }).transform(secret, { type: 'query', data: 'id' }),
    );

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain(secret);
  });

  it('never shows the value of a sensitive type', () => {
    const logger = debugLogger();

    n.configure({ logger });
    quietly(() => new NominalPipe(Password).transform(secret, { type: 'body', data: 'password' }));
    // oxlint-disable-next-line typescript/no-deprecated
    quietly(() => toGraphQL(Password).parseValue(secret));

    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain(secret);
  });

  it('calls nothing for accepted values, and nothing without a debug method', () => {
    const logger = debugLogger();
    const pipe = new NominalPipe(Uuid);
    const scalar = toGraphQL(Uuid);
    const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

    n.configure({ logger });

    for (let run = 0; run < 100; run += 1) {
      pipe.transform(id, { type: 'query', data: 'id' });
      // oxlint-disable-next-line typescript/no-deprecated
      scalar.parseValue(id);
    }

    expect(logger.debug).not.toHaveBeenCalled();

    const warnOnly = { warn: vi.fn<Method>() };

    n.configure({ logger: warnOnly });
    quietly(() => pipe.transform('nope', { type: 'query', data: 'id' }));

    expect(warnOnly.warn).not.toHaveBeenCalled();
  });
});

describe('nestLogger()', () => {
  type NestMethod = (message: unknown, ...optionalParams: unknown[]) => void;

  const nestService = (): LoggerService & {
    readonly warn: Mock<NestMethod>;
    readonly debug: Mock<NestMethod>;
  } => ({
    log: vi.fn<NestMethod>(),
    error: vi.fn<NestMethod>(),
    warn: vi.fn<NestMethod>(),
    debug: vi.fn<NestMethod>(),
  });

  it('passes the message first and the details as the next parameter', () => {
    const service = nestService();
    const logger = nestLogger(service);

    logger.warn('declared twice', { typeName: 'shop.Sku' });
    logger.warn('blocked');
    logger.debug?.('rejected', { issues: [] });

    expect(service.warn.mock.calls).toEqual([
      ['declared twice', { typeName: 'shop.Sku' }],
      ['blocked'],
    ]);
    expect(service.debug).toHaveBeenCalledExactlyOnceWith('rejected', { issues: [] });
  });

  it('skips debug entries for a logger without debug', () => {
    const logger = nestLogger({
      log: vi.fn<NestMethod>(),
      error: vi.fn<NestMethod>(),
      warn: vi.fn<NestMethod>(),
    });

    expect(() => logger.debug?.('rejected', {})).not.toThrow();
  });

  it("writes through Nest's Logger with the context NominalTypes by default", () => {
    const warn = vi.spyOn(NestLogger.prototype, 'warn').mockImplementation(() => {});

    n.configure({ logger: nestLogger() });
    Nominal('logged.Twice', /^a$/u);
    Nominal('logged.Twice', /^b$/u);

    expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^the type name/u), {
      typeName: 'logged.Twice',
    });
    expect(warn.mock.contexts[0]).toMatchObject({ context: 'NominalTypes' });
  });
});
