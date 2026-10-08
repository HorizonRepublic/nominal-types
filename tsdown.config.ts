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

const config: UserConfig = {
  entry: {
    index: 'src/index.ts',
    'core/n': 'src/core/n.ts',
    'temporal/index': 'src/temporal/index.ts',
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
  },
  format: ['esm', 'cjs'],
  inputOptions: (options, format) =>
    format === 'es' ? { ...options, plugins: [namespaceN, options.plugins] } : options,
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  // Bundlers drop whole modules an app doesn't use, by `sideEffects: false`, only when each
  // source file stays a module of its own. CommonJS can't be tree-shaken, so it stays one file
  // per entry, which Node loads faster.
  outputOptions: (options, format, { cjsDts }) => ({
    ...options,
    sourcemapExcludeSources: true,
    ...(format === 'es' && !cjsDts ? { preserveModules: true, preserveModulesRoot: 'src' } : {}),
  }),
  clean: true,
  publint: true,
  attw: { profile: 'strict', level: 'error' },
};

export default config;
