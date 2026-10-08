import type { UserConfig } from 'tsdown';

const config: UserConfig = {
  entry: {
    index: 'src/index.ts',
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
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  outputOptions: { sourcemapExcludeSources: true },
  clean: true,
  publint: true,
  attw: { profile: 'strict', level: 'error' },
};

export default config;
