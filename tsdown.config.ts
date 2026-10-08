import type { UserConfig } from 'tsdown';

/**
 * Keeps `export * as n from './core/n.js'` in the root entry instead of the object of getters
 * rolldown builds for a namespace, so an app bundler keeps only the `n` functions it calls.
 */
const namespaceN = {
  name: 'namespace-n',
  resolveId: (source: string, importer: string | undefined) =>
    source === './core/n.ts' && importer?.endsWith('/src/index.ts') === true
      ? { id: './core/n.js', external: true }
      : undefined,
};

// Every module under core/ but the entry of `n`. A declaration module keeps `.d` at the end of its
// chunk name, which the declaration build reads.
const corePath = /[\\/]src[\\/]core[\\/](?!n\.).+?(\.d)?\.ts$/u;
// Every module under types/ and temporal/ but the temporal entry itself.
const typePath = /[\\/]src[\\/]((?:types|temporal)[\\/](?!index\.).+)\.ts$/u;
// A module under adapters/, kept in place when more than one adapter uses it.
const adapterPath = /[\\/]src[\\/](adapters[\\/].+)\.ts$/u;

const pathName = (path: RegExp, id: string): string | null =>
  path.exec(id)?.[1]?.replaceAll('\\', '/') ?? null;

// Bundlers drop whole modules an app doesn't use, by `sideEffects: false`, so each type stays a
// module of its own; a type declared at the top level of a shared chunk would stay in every bundle.
// The core every type needs is one chunk, since plain Node pays for every module it loads.
const esmChunks = {
  chunkFileNames: '[name].js',
  codeSplitting: {
    groups: [
      {
        name: (id: string) => {
          const core = corePath.exec(id);

          return core === null ? null : `core/shared${core[1] ?? ''}`;
        },
        priority: 2,
      },
      {
        name: (id: string) => pathName(typePath, id),
        priority: 1,
        includeDependenciesRecursively: false,
      },
      {
        name: (id: string) => pathName(adapterPath, id),
        minShareCount: 2,
        includeDependenciesRecursively: false,
      },
    ],
  },
};

const config: UserConfig = {
  entry: {
    index: 'src/index.ts',
    'core/n': 'src/core/n.ts',
    'temporal/index': 'src/temporal/index.ts',
    'testing/index': 'src/testing/index.ts',
    'adapters/nest/index': 'src/adapters/nest/index.ts',
    'adapters/class-validator/index': 'src/adapters/class-validator/index.ts',
    'adapters/swagger/index': 'src/adapters/swagger/index.ts',
    'adapters/arktype/index': 'src/adapters/arktype/index.ts',
    'adapters/zod/index': 'src/adapters/zod/index.ts',
    'adapters/valibot/index': 'src/adapters/valibot/index.ts',
    'adapters/mikro-orm/index': 'src/adapters/mikro-orm/index.ts',
    'adapters/typeorm/index': 'src/adapters/typeorm/index.ts',
    'adapters/drizzle/index': 'src/adapters/drizzle/index.ts',
    'adapters/sequelize/index': 'src/adapters/sequelize/index.ts',
    'adapters/graphql/index': 'src/adapters/graphql/index.ts',
    'adapters/superjson/index': 'src/adapters/superjson/index.ts',
    'adapters/fastify/index': 'src/adapters/fastify/index.ts',
  },
  format: ['esm', 'cjs'],
  inputOptions: (options, format) =>
    format === 'es' ? { ...options, plugins: [namespaceN, options.plugins] } : options,
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  // CommonJS can't be tree-shaken, so it stays one file per entry, which Node loads faster.
  outputOptions: (options, format, { cjsDts }) => ({
    ...options,
    sourcemapExcludeSources: true,
    ...(format === 'es' && !cjsDts ? esmChunks : {}),
  }),
  clean: true,
  publint: true,
  attw: { profile: 'strict', level: 'error' },
};

export default config;
