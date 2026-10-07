import type { UserConfig } from 'tsdown';

const config: UserConfig = {
  entry: {
    index: 'src/index.ts',
    'adapters/nest/index': 'src/adapters/nest/index.ts',
    'adapters/class-validator/index': 'src/adapters/class-validator/index.ts',
    'adapters/swagger/index': 'src/adapters/swagger/index.ts',
    'adapters/arktype/index': 'src/adapters/arktype/index.ts',
    'adapters/zod/index': 'src/adapters/zod/index.ts',
    'adapters/valibot/index': 'src/adapters/valibot/index.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  publint: true,
  attw: { profile: 'node16', level: 'error' },
};

export default config;
