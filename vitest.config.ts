import swc from 'unplugin-swc';
import type { ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = {
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
          useDefineForClassFields: true,
        },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  oxc: false,
  test: {
    include: ['tests/**/*.spec.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'json-summary', 'json'],
      reportOnFailure: true,
    },
  },
};

export default config;
