import type { ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = {
  oxc: {
    decorator: { legacy: true, emitDecoratorMetadata: true },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    isolate: false,
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
