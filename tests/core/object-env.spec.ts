import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import {
  AnyBoolean,
  AnyString,
  Int64,
  n,
  Nominal,
  NominalError,
  PositiveInteger,
  Uint16,
  Url,
} from '../../src/index.ts';
import { issuesOf, thrownBy, valueOf } from '../support/results.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

class Port extends Uint16.subtype('envtest.Port') {}

const Settings = n
  .object({
    PORT: Port,
    DEBUG: AnyBoolean,
    DATABASE_URL: Url,
    LIMIT: Int64,
    NAME: n.of(AnyString).optional(),
    WORKERS: n.of(PositiveInteger).fromString().optional(),
  })
  .fromEnv();

const env = {
  PORT: '3000',
  DEBUG: 'false',
  DATABASE_URL: 'postgres://db/app',
  LIMIT: '9007199254740993',
  HOME: '/root',
};

describe('n.object().fromEnv()', () => {
  it('reads numbers, booleans, big integers and strings from text, and drops other keys', () => {
    const settings = valueOf(Settings.parse(env));

    expect(settings.PORT).toStrictEqual(new Port(3000));
    expect(settings.DEBUG).toStrictEqual(new AnyBoolean(false));
    expect(settings.DATABASE_URL.value).toBe('postgres://db/app');
    expect(settings.LIMIT).toStrictEqual(new Int64(9_007_199_254_740_993n));
    expect(settings).not.toHaveProperty('HOME');
    expect(settings).not.toHaveProperty('NAME');
  });

  it('keeps values that are not text, and fields of other schemas, as they are', () => {
    const settings = valueOf(Settings.parse({ ...env, PORT: 8080, WORKERS: '4', NAME: 'app' }));

    expect(settings.PORT).toStrictEqual(new Port(8080));
    expect(settings.WORKERS).toStrictEqual(new PositiveInteger(4));
    expect(settings.NAME?.value).toBe('app');
  });

  it('reports every missing or bad variable, leaving the values out', () => {
    expect(issuesOf(Settings.parse({ PORT: 'abc', DEBUG: 'yes', LIMIT: '1.5' }))).toStrictEqual([
      { message: 'must be a number (was a string of 3 characters)', path: ['PORT'] },
      { message: 'must be a boolean (was a string of 3 characters)', path: ['DEBUG'] },
      { message: 'is required', path: ['DATABASE_URL'] },
      {
        message:
          'must be a bigint, an integer string or a safe integer (was a string of 3 characters)',
        path: ['LIMIT'],
      },
    ]);
  });

  it('keeps a secret out of the messages and out of the error a class throws', () => {
    const secret = 'postgres admin:S3cr3t@db/x';

    class Config extends Nominal('envtest.SecretConfig', Settings) {}

    expect(issuesOf(Settings.parse({ ...env, DATABASE_URL: secret }))).toStrictEqual([
      { message: 'must be a URL (was a string of 26 characters)', path: ['DATABASE_URL'] },
    ]);
    expect(String(thrownBy(() => new Config({ ...env, DATABASE_URL: secret })))).not.toContain(
      'S3cr3t',
    );
  });

  it('shows the values of the object it was made from', () => {
    expect(issuesOf(n.object({ DATABASE_URL: Url }).parse({ DATABASE_URL: 'nope' }))).toStrictEqual(
      [{ message: 'must be a URL (was "nope")', path: ['DATABASE_URL'] }],
    );
  });

  it('leaves the values out after strict(), in nested objects and arrays of it', () => {
    const Nested = n.object({ DB: n.object({ URL: Url }) }).fromEnv();

    expect(issuesOf(Settings.strict().parse({ PORT: 'abc', HOME: '/root' }))).toStrictEqual([
      { message: 'must be a number (was a string of 3 characters)', path: ['PORT'] },
      { message: 'is required', path: ['DEBUG'] },
      { message: 'is required', path: ['DATABASE_URL'] },
      { message: 'is required', path: ['LIMIT'] },
      { message: 'is not allowed', path: ['HOME'] },
    ]);
    expect(issuesOf(Nested.parse({ DB: { URL: 'nope' } }))).toStrictEqual([
      { message: 'must be a URL (was a string of 4 characters)', path: ['DB', 'URL'] },
    ]);
    expect(issuesOf(Nested.array().parse([{ DB: { URL: 'nope' } }]))).toStrictEqual([
      { message: 'must be a URL (was a string of 4 characters)', path: [0, 'DB', 'URL'] },
    ]);
  });

  it('leaves the values out for types from another copy of the package', async () => {
    const copy = await anotherCopy();
    const Remote = n.object({ DATABASE_URL: copy.Url }).fromEnv();

    expect(issuesOf(Remote.parse({ DATABASE_URL: 'nope' }))).toStrictEqual([
      { message: 'must be a URL (was a string of 4 characters)', path: ['DATABASE_URL'] },
    ]);
  });

  it('refuses a port out of range read from text', () => {
    expect(issuesOf(Settings.parse({ ...env, PORT: '70000' }))).toHaveLength(1);
  });

  it('keeps constraints and strictness', () => {
    const Ranged = n
      .object(
        { MIN: PositiveInteger, MAX: PositiveInteger },
        n.constraint({ MIN: PositiveInteger, MAX: PositiveInteger }, ({ MIN, MAX }) => MAX >= MIN),
      )
      .strict()
      .fromEnv();

    expect(Ranged.parse({ MIN: '1', MAX: '2' }).ok).toBe(true);
    expect(Ranged.parse({ MIN: '3', MAX: '2' }).ok).toBe(false);
    expect(issuesOf(Ranged.parse({ MIN: '1', MAX: '2', HOME: '/' }))).toStrictEqual([
      { message: 'is not allowed', path: ['HOME'] },
    ]);
  });

  it('makes a config class that takes process.env and throws with every issue', () => {
    class Config extends Nominal('envtest.Config', Settings) {}

    const config = new Config({ ...env } satisfies NodeJS.ProcessEnv);

    expect(config.PORT.value).toBe(3000);
    expectTypeOf(config.PORT).toEqualTypeOf<Port>();
    expect(() => new Config({})).toThrow(NominalError);
  });

  it('is asked for on objects, where fromString() points to it', () => {
    expect(() => n.object({ PORT: Port }).fromString()).toThrow(
      new TypeError(
        'fromString(): call it on n.of(Type) of a string, number, bigint or boolean type, before array(), optional() or nullable(); for an n.object() schema, call fromEnv()',
      ),
    );
  });
});
