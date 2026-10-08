import { Logger as NestLogger } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';

import type { Logger } from '../../core/log.ts';

/**
 * Sends the package's warnings to Nest's logger, so they appear with the app's other logs and go
 * wherever `app.useLogger()` sends them, such as to pino through nestjs-pino.
 *
 * @remarks
 * The default, `new Logger('NominalTypes')`, writes through the logger the app uses at the time of
 * each entry, so the call can come before the app is created. Details follow the message as an
 * extra parameter.
 *
 * @param logger - The Nest logger to write to.
 * @returns A logger for `n.configure({ logger })`.
 *
 * @example
 * ```ts
 * // nominal.config.ts
 * import { n } from '@horizon-republic/nominal-types';
 * import { nestLogger } from '@horizon-republic/nominal-types/adapters/nest';
 *
 * n.configure({ logger: nestLogger() });
 * ```
 */
export const nestLogger = (logger: LoggerService = new NestLogger('NominalTypes')): Logger => ({
  warn: (message, details) => {
    if (details === undefined) {
      logger.warn(message);
    } else {
      logger.warn(message, details);
    }
  },
  debug: (message, details) => {
    logger.debug?.(message, details);
  },
});
