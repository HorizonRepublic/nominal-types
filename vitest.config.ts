import type { ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = {
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
