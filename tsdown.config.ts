import type { UserConfig } from 'tsdown';

const config: UserConfig = {
  entry: ['src/index.ts'],
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
