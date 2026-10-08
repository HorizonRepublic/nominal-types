import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { settings } from '../../src/core/settings.ts';
import type * as library from '../../src/index.ts';
import { n, Nominal, pinoLogger } from '../../src/index.ts';
import type { Configuration, Logger } from '../../src/index.ts';
import { resetConfigurationAfterEach } from '../support/configuration.ts';

type Library = typeof library;

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

type Warn = Logger['warn'];

const fakeLogger = (): { readonly warn: Mock<Warn> } => ({ warn: vi.fn<Warn>() });

const clash = (name: string, nominal: typeof Nominal = Nominal): void => {
  nominal(name, /^a$/u);
  nominal(name, /^b$/u);
};

resetConfigurationAfterEach();

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('n.configure({ logger })', () => {
  it('writes warnings with console.warn by default, naming the package', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(n.configure().logger).toBeUndefined();

    clash('logger.Default');

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      '@horizon-republic/nominal-types: the type name "logger.Default" is declared twice with different rules; the two types will pass for each other. Give each type a unique name.',
    );
  });

  it('sends a type name declared twice to the logger, with the name in the details', () => {
    const fromConsole = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = fakeLogger();

    n.configure({ logger });
    clash('logger.Custom');
    clash('logger.Custom');

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      'the type name "logger.Custom" is declared twice with different rules; the two types will pass for each other. Give each type a unique name.',
      { typeName: 'logger.Custom' },
    );
    expect(fromConsole).not.toHaveBeenCalled();
  });

  it('calls the logger as a method, so a class instance keeps this', () => {
    const seen: unknown[] = [];

    class AppLogger {
      public readonly lines = seen;

      public warn(message: string): void {
        this.lines.push(message);
      }
    }

    n.configure({ logger: new AppLogger() });
    clash('logger.Method');

    expect(seen).toHaveLength(1);
  });

  it('accepts console itself', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    n.configure({ logger: console });
    clash('logger.Console');

    expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^the type name/u), {
      typeName: 'logger.Console',
    });
  });

  it('silences every warning with false', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    n.configure({ logger: false });
    clash('logger.Silent');

    expect(warn).not.toHaveBeenCalled();
  });

  it('returns the logger it replaces, and undefined brings console.warn back', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = fakeLogger();

    const previous = n.configure({ logger });

    expect(previous.logger).toBeUndefined();
    expect(n.configure(previous).logger).toBe(logger);

    clash('logger.Restored');

    expect(logger.warn).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('keeps the logger when another option is changed', () => {
    const logger = fakeLogger();

    n.configure({ logger });
    n.configure({ codes: true });

    expect(n.configure().logger).toBe(logger);
  });

  it.each([
    ['a number', 1],
    ['true', true],
    ['null', null],
    ['a function', () => {}],
    ['an object without warn', {}],
    ['a warn that is not a method', { warn: 'loud' }],
    ['a debug that is not a method', { warn: () => {}, debug: 'loud' }],
  ])('refuses %s and changes nothing', (_, logger) => {
    const kept = fakeLogger();

    n.configure({ logger: kept });

    // The wrong option is the point of this test.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    expect(() => n.configure({ logger } as unknown as Configuration)).toThrow(
      new TypeError(
        'n.configure(): logger must be an object with a warn method and an optional debug method, or false',
      ),
    );
    expect(n.configure().logger).toBe(kept);
  });

  it('takes a logger with a debug method', () => {
    const logger = { warn: (): void => {}, debug: (): void => {} };

    n.configure({ logger });

    expect(n.configure().logger).toBe(logger);
  });

  it('is shared by another copy of the package', async () => {
    const logger = fakeLogger();

    n.configure({ logger });

    const copy = await anotherCopy();

    clash('logger.Copy', copy.Nominal);

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(expect.any(String), {
      typeName: 'logger.Copy',
    });
    expect(copy.n.configure().logger).toBe(logger);
  });
});

const blockCodegen = (): void => {
  vi.stubGlobal('Function', () => {
    throw new EvalError('Code generation from strings disallowed for this context');
  });
};

describe('the fallback from generated code', () => {
  afterEach(() => {
    delete settings.codegenWarned;
  });

  it('warns once per process when the runtime blocks new Function', async () => {
    const logger = fakeLogger();

    delete settings.codegenWarned;
    n.configure({ logger });

    const first = await anotherCopy();
    const second = await anotherCopy();

    blockCodegen();

    expect(first.Uuid.parse('nope').ok).toBe(false);
    expect(second.Uuid.parse('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f').ok).toBe(true);

    vi.unstubAllGlobals();

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      "new Function is blocked, so checks run slower; set n.configure({ codegen: 'off' })",
      undefined,
    );
  });

  it("stays silent with codegen: 'off'", async () => {
    const logger = fakeLogger();

    delete settings.codegenWarned;
    n.configure({ logger, codegen: 'off' });

    const copy = await anotherCopy();

    blockCodegen();
    copy.Email.parse('nope');
    vi.unstubAllGlobals();

    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('pinoLogger()', () => {
  it('passes the details first and the message second', () => {
    type Method = (details: Record<string, unknown>, message: string) => void;

    const pino = { warn: vi.fn<Method>(), debug: vi.fn<Method>() };
    const logger = pinoLogger(pino);

    logger.warn('declared twice', { typeName: 'shop.Sku' });
    logger.warn('blocked');
    logger.debug?.('rejected', { issues: [] });

    expect(pino.warn.mock.calls).toEqual([
      [{ typeName: 'shop.Sku' }, 'declared twice'],
      [{}, 'blocked'],
    ]);
    expect(pino.debug).toHaveBeenCalledExactlyOnceWith({ issues: [] }, 'rejected');
  });

  it('calls the pino logger as a method', () => {
    const seen: unknown[] = [];
    const pino = {
      lines: seen,
      warn(details: Record<string, unknown>, message: string): void {
        this.lines.push([details, message]);
      },
      debug(): void {},
    };

    n.configure({ logger: pinoLogger(pino) });
    clash('logger.Pino');

    expect(seen).toEqual([[{ typeName: 'logger.Pino' }, expect.stringMatching(/^the type name/u)]]);
  });
});
