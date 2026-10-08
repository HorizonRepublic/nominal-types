import { afterEach } from 'vitest';

import type { Configuration } from '../../src/index.ts';
import { n } from '../../src/index.ts';

const defaults: Configuration = {
  messages: undefined,
  values: 'show',
  inspect: 'show',
  normalize: { trimStrings: false },
  codes: false,
  codegen: 'auto',
  logger: undefined,
};

/**
 * Puts the settings back after each test of the file, since test files share one process.
 */
export const resetConfigurationAfterEach = (): void => {
  afterEach(() => {
    n.configure(defaults);
  });
};

/**
 * Runs `check` with `options` set, and puts the settings back afterwards.
 */
export const configured = <Result>(options: Configuration, check: () => Result): Result => {
  const previous = n.configure(options);

  try {
    return check();
  } finally {
    n.configure(previous);
  }
};
