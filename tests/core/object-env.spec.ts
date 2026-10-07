import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  AnyBoolean,
  AnyString,
  constraint,
  Int64,
  Nominal,
  NominalError,
  objectOf,
  PositiveInteger,
  schemaOf,
  Uint16,
  Url,
} from '../../src/index.ts';
import { issuesOf, valueOf } from '../support/results.ts';

class Port extends Uint16.subtype('envtest.Port') {}

const Settings = objectOf({
  PORT: Port,
  DEBUG: AnyBoolean,
  DATABASE_URL: Url,
  LIMIT: Int64,
  NAME: schemaOf(AnyString).optional(),
  WORKERS: schemaOf(PositiveInteger).fromString().optional(),
}).fromEnv();

const env = {
  PORT: '3000',
  DEBUG: 'false',
  DATABASE_URL: 'postgres://db/app',
  LIMIT: '9007199254740993',
  HOME: '/root',
};

describe('objectOf().fromEnv()', () => {
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

  it('reports every missing or bad variable', () => {
    expect(issuesOf(Settings.parse({ PORT: 'abc', DEBUG: 'yes', LIMIT: '1.5' }))).toStrictEqual([
      { message: 'must be a number (was "abc")', path: ['PORT'] },
      { message: 'must be a boolean (was "yes")', path: ['DEBUG'] },
      { message: 'must be a URL (was undefined)', path: ['DATABASE_URL'] },
      { message: 'must be a bigint or an integer string (was "1.5")', path: ['LIMIT'] },
    ]);
  });

  it('refuses a port out of range read from text', () => {
    expect(issuesOf(Settings.parse({ ...env, PORT: '70000' }))).toHaveLength(1);
  });

  it('keeps constraints and strictness', () => {
    const Ranged = objectOf(
      { MIN: PositiveInteger, MAX: PositiveInteger },
      constraint({ MIN: PositiveInteger, MAX: PositiveInteger }, ({ MIN, MAX }) => MAX >= MIN),
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
    expect(() => objectOf({ PORT: Port }).fromString()).toThrow(
      new TypeError(
        'fromString(): call it on schemaOf(Type) of a string, number, bigint or boolean type, before array(), optional() or nullable(); for an objectOf() schema, call fromEnv()',
      ),
    );
  });
});
