import { issueCodes } from './issue-codes.ts';
import type { Messages } from './issue-codes.ts';
import { issueWriter } from './issue-writer.ts';
import type { Logger } from './log.ts';
import { settings } from './settings.ts';

/**
 * Settings for the whole process, given to `n.configure()`: how messages read, whether they and
 * logs show values, whether strings are trimmed, whether code is generated, and where warnings go.
 */
export interface Configuration {
  /**
   * Writes the messages in place of the English ones, for another language or your own wording:
   * a function for every issue, or a map by issue code. A function returning `undefined`, or a
   * code the map leaves out, keeps the English message. `undefined` restores the English messages.
   *
   * @defaultValue `undefined`, the English messages.
   */
  readonly messages?: Messages | undefined;
  /**
   * How messages show the rejected value: `'show'` writes it, except for a sensitive type;
   * `'length'` tells every value by its kind and length, `a string of 4 characters`; `'hide'`
   * leaves it out.
   *
   * @defaultValue `'show'`
   */
  readonly values?: 'show' | 'length' | 'hide' | undefined;
  /**
   * Whether `console.log` and `util.inspect` show the values of instances: `'hide'` shows every
   * instance as a sensitive type's, `Uuid { value: <hidden, a string of 36 characters> }`.
   *
   * @defaultValue `'show'`
   */
  readonly inspect?: 'show' | 'hide' | undefined;
  /**
   * Changes made to input before the check. With `trimStrings`, every type under `AnyString`
   * trims a string first, and `fromString()` and `fromEnv()` trim text before reading it.
   *
   * @defaultValue `{ trimStrings: false }`
   */
  readonly normalize?:
    | {
        /**
         * Whether strings are trimmed before the check.
         *
         * @defaultValue `false`
         */
        readonly trimStrings?: boolean | undefined;
      }
    | undefined;
  /**
   * Gives every issue its `code`, such as `'required'`, next to the message.
   *
   * @defaultValue `false`
   */
  readonly codes?: boolean | undefined;
  /**
   * `'off'` builds every check without `new Function`, for a Content-Security-Policy without
   * `'unsafe-eval'`; checks built before the call keep how they were built.
   *
   * @defaultValue `'auto'`, which generates code where the runtime allows it.
   */
  readonly codegen?: 'auto' | 'off' | undefined;
  /**
   * Sends the package's warnings, and the values adapters reject, to the logger of your app;
   * `false` silences them. `undefined` restores the default.
   *
   * @defaultValue `undefined`, which writes warnings with `console.warn` and nothing else.
   */
  readonly logger?: Logger | false | undefined;
}

/**
 * Every setting `n.configure()` holds, as it returns them.
 */
export interface FullConfiguration {
  /**
   * The messages in place of the English ones, or `undefined` for the English messages.
   */
  readonly messages: Messages | undefined;
  /**
   * How messages show the rejected value.
   */
  readonly values: 'show' | 'length' | 'hide';
  /**
   * Whether `console.log` and `util.inspect` show the values of instances.
   */
  readonly inspect: 'show' | 'hide';
  /**
   * The changes made to input before the check.
   */
  readonly normalize: { readonly trimStrings: boolean };
  /**
   * Whether every issue carries its `code`.
   */
  readonly codes: boolean;
  /**
   * Whether checks are built with generated code (`'auto'`) or without it (`'off'`).
   */
  readonly codegen: 'auto' | 'off';
  /**
   * Where warnings go: a logger, `false` for nowhere, or `undefined` for `console.warn`.
   */
  readonly logger: Logger | false | undefined;
}

const snapshot = (): FullConfiguration =>
  Object.freeze({
    messages: settings.messages,
    values: settings.values,
    inspect: settings.inspect,
    normalize: Object.freeze({ trimStrings: settings.trimStrings }),
    codes: settings.codes,
    codegen: settings.codegen,
    logger: settings.logger,
  });

/**
 * Refuses the options of `n.configure()` with a message.
 *
 * @throws {@link TypeError} when called: it always throws, naming `n.configure()`.
 *
 * @internal
 */
const fail = (message: string): never => {
  throw new TypeError(`n.configure(): ${message}`);
};

// The options that take one of a few values, in the order their values are checked.
const choices = {
  values: ['show', 'length', 'hide'],
  inspect: ['show', 'hide'],
  codes: [true, false],
  codegen: ['auto', 'off'],
} as const;

const choiceNames = ['values', 'inspect', 'codes', 'codegen'] as const;

// A Set built at load would stay in bundles that never call n.configure(); an array literal doesn't.
// oxlint-disable-next-line unicorn/prefer-set-has
const options: readonly string[] = [
  'values',
  'inspect',
  'codes',
  'codegen',
  'messages',
  'normalize',
  'logger',
];

const listed = (items: readonly unknown[]): string => {
  // @throws-ignore the items are option names and the literal choices of an option
  const texts = items.map((item) => JSON.stringify(item));

  return `${texts.slice(0, -1).join(', ')} or ${String(texts.at(-1))}`;
};

/**
 * Refuses a value outside the choices of an option.
 *
 * @throws {@link TypeError} when the value is not one of the allowed choices.
 *
 * @internal
 */
const choice = <Choice>(
  name: string,
  value: Choice | undefined,
  allowed: readonly Choice[],
): void => {
  if (value !== undefined && !allowed.includes(value)) {
    fail(`${name} must be ${listed(allowed)}`);
  }
};

/**
 * The `trimStrings` setting `normalize` gives.
 *
 * @throws {@link TypeError} when `normalize` is not an object of known options with allowed values.
 *
 * @internal
 */
const trimStringsOf = (normalize: unknown): boolean | undefined => {
  if (normalize === undefined) {
    return undefined;
  }

  if (typeof normalize !== 'object' || normalize === null) {
    return fail('normalize must be an object, such as { trimStrings: true }');
  }

  const extra = Object.keys(normalize).find((name) => name !== 'trimStrings');

  if (extra !== undefined) {
    fail(`there is no option normalize.${extra}`);
  }

  const trimStrings: unknown = Reflect.get(normalize, 'trimStrings');

  choice('normalize.trimStrings', trimStrings, [true, false]);

  return typeof trimStrings === 'boolean' ? trimStrings : undefined;
};

const frozen = (messages: Messages | undefined): Messages | undefined =>
  typeof messages === 'object' ? Object.freeze({ ...messages }) : messages;

/**
 * Refuses a `messages` option of the wrong shape.
 *
 * @throws {@link TypeError} when the messages are neither a function nor a map of known issue codes
 * to strings or functions.
 *
 * @internal
 */
const checkMessages = (messages: unknown): void => {
  if (messages === undefined || typeof messages === 'function') {
    return;
  }

  if (typeof messages !== 'object' || messages === null || Array.isArray(messages)) {
    fail('messages must be a function, a map by issue code or undefined');

    return;
  }

  for (const [code, message] of Object.entries(messages)) {
    if (!issueCodes.some((known) => known === code)) {
      fail(`there is no issue code ${code}`);
    }

    if (typeof message !== 'string' && typeof message !== 'function') {
      fail(`messages.${code} must be a string or a function`);
    }
  }
};

const isLogger = (logger: unknown): boolean =>
  typeof logger === 'object' &&
  logger !== null &&
  typeof Reflect.get(logger, 'warn') === 'function' &&
  ['function', 'undefined'].includes(typeof Reflect.get(logger, 'debug'));

/**
 * Refuses a `logger` option of the wrong shape.
 *
 * @throws {@link TypeError} when the logger is neither `false`, `undefined` nor an object with a
 * `warn` method and, if any, a `debug` method.
 *
 * @internal
 */
const checkLogger = (logger: unknown): void => {
  if (logger !== undefined && logger !== false && !isLogger(logger)) {
    fail('logger must be an object with a warn method and an optional debug method, or false');
  }
};

/**
 * The settings the options change.
 *
 * @throws {@link TypeError} when an option doesn't exist or has a value it doesn't take.
 *
 * @internal
 */
const changesOf = (given: Configuration): Readonly<Record<string, unknown>> => {
  const unknown = Object.keys(given).find((name) => !options.includes(name));

  if (unknown !== undefined) {
    fail(`there is no option ${unknown}`);
  }

  checkMessages(given.messages);
  checkLogger(given.logger);

  for (const name of choiceNames) {
    choice(name, given[name], choices[name]);
  }

  const trimStrings = trimStringsOf(given.normalize);
  const chosen = choiceNames.filter((name) => given[name] !== undefined);

  return {
    ...('messages' in given ? { messages: frozen(given.messages) } : {}),
    ...('logger' in given ? { logger: given.logger } : {}),
    ...Object.fromEntries(chosen.map((name) => [name, given[name]])),
    ...(trimStrings === undefined ? {} : { trimStrings }),
  };
};

/**
 * Sets how this package behaves in the whole process, once at startup: messages in another
 * language, values left out of messages and logs, strings trimmed, no code generation.
 *
 * @remarks
 * Call it in a module of its own that your entry point imports first, so it runs before any check.
 * Each call changes only the options it names and returns every setting as it was before, so a
 * test can put them back with `n.configure(previous)`. The settings are shared by every copy of
 * the package loaded in the process, the ES module and the CommonJS one alike. Messages, values,
 * `inspect`, `codes` and trimming apply from the next check on; `codegen` applies to checks built
 * after the call; `logger` applies from the next warning.
 *
 * @param given - The options to change; the others keep their setting.
 * @returns Every setting as it was before the call.
 * @throws {@link TypeError} when an option doesn't exist or has a value it doesn't take; nothing is
 * changed then.
 *
 * @example
 * ```ts
 * // nominal.config.ts
 * import { n } from '@horizon-republic/nominal-types';
 *
 * n.configure({ values: 'length', normalize: { trimStrings: true } });
 * ```
 */
export const configure = (given: Configuration = {}): FullConfiguration => {
  if (typeof given !== 'object' || given === null) {
    fail('pass an object of options');
  }

  const changes = changesOf(given);
  const previous = snapshot();

  Object.assign(settings, changes);

  if (settings.codes || settings.messages !== undefined) {
    settings.writer = issueWriter;
  }

  return previous;
};
