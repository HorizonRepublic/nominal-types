import type { Logger } from './log.ts';

type Method = (details: Record<string, unknown>, message: string) => void;

/**
 * A pino logger, or any logger that takes the fields first and the message second, as bunyan
 * does.
 */
export interface ObjectFirstLogger {
  /**
   * Writes a warning.
   */
  readonly warn: Method;
  /**
   * Writes a debug entry.
   */
  readonly debug: Method;
}

/**
 * Sends the package's warnings to a pino logger, such as `app.log` in Fastify, with the details
 * as fields of the entry.
 *
 * @remarks
 * pino takes the fields first and the message second, the other way round from {@link Logger}.
 * Pass a child logger, `log.child({ module: 'nominal-types' })`, to tell the package's entries
 * apart.
 *
 * @param logger - The pino or bunyan logger.
 * @returns A logger for `n.configure({ logger })`.
 *
 * @example
 * ```ts
 * import { n, pinoLogger } from '@horizon-republic/nominal-types';
 * import type { ObjectFirstLogger } from '@horizon-republic/nominal-types';
 *
 * declare const log: ObjectFirstLogger;
 *
 * n.configure({ logger: pinoLogger(log) });
 * ```
 */
export const pinoLogger = (logger: ObjectFirstLogger): Logger => ({
  warn: (message, details = {}) => {
    logger.warn(details, message);
  },
  debug: (message, details = {}) => {
    logger.debug(details, message);
  },
});
