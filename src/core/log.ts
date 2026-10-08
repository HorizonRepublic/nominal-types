import { settings } from './settings.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';

/**
 * Where this package sends what it reports, given to `n.configure({ logger })`: the logger of
 * your app, so the package's warnings land in its logs.
 *
 * @remarks
 * `console`, winston and any logger that takes the message first fit as they are. For pino and
 * bunyan, which take an object first, wrap the logger in {@link pinoLogger}; for Nest, use
 * `nestLogger()` from the Nest adapter.
 *
 * @see {@link pinoLogger}
 */
export interface Logger {
  /**
   * Receives what needs your attention: a type name declared twice with different rules, or
   * checks that can't use generated code.
   *
   * @param message - What happened and what to do about it.
   * @param details - The facts in fields, such as `typeName`.
   */
  readonly warn: (message: string, details?: Record<string, unknown>) => void;
  /**
   * Receives each value an adapter rejects, with the issue codes and paths, to find why a request
   * failed. Leave it out to skip that work.
   *
   * @defaultValue `undefined`, nothing is reported.
   *
   * @param message - Which adapter rejected which part of the input.
   * @param details - The issues, with the values hidden as the messages hide them.
   */
  readonly debug?: ((message: string, details?: Record<string, unknown>) => void) | undefined;
}

/**
 * Reports a warning to the logger `n.configure()` set, or to `console.warn` when none was set.
 *
 * @internal
 */
export const warn = (message: string, details?: Record<string, unknown>): void => {
  const { logger } = settings;

  if (logger === undefined) {
    // The default logger: the package runs outside Node too.
    // oxlint-disable-next-line no-console
    console.warn(`@horizon-republic/nominal-types: ${message}`);

    return;
  }

  if (logger !== false) {
    logger.warn(message, details);
  }
};

const issueOf = ({ message, path, ...rest }: StandardSchemaV1.Issue): Record<string, unknown> => ({
  ...('code' in rest ? { code: rest.code } : {}),
  ...(path === undefined
    ? {}
    : { path: path.map((segment) => (typeof segment === 'object' ? segment.key : segment)) }),
  message,
});

/**
 * Reports a value an adapter rejected to the `debug` method of the logger, if it has one; the
 * issues come with their values hidden as the messages hide them.
 *
 * @internal
 */
export const debugRejection = (
  message: string,
  details: Record<string, unknown>,
  issues: readonly StandardSchemaV1.Issue[],
): void => {
  const { logger } = settings;

  if (logger !== undefined && logger !== false && logger.debug !== undefined) {
    logger.debug(message, { ...details, issues: issues.map((issue) => issueOf(issue)) });
  }
};
