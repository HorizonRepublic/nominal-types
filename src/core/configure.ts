import { issueCodes } from './issue-codes.ts';
import type { Messages } from './issue-codes.ts';
import { settings } from './settings.ts';
import type { Settings } from './settings.ts';

/**
 * Settings for the whole process, given to `n.configure()`: how messages read, whether they and
 * logs show values, whether strings are trimmed, and whether code is generated.
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
}

const snapshot = (): FullConfiguration =>
  Object.freeze({
    messages: settings.messages,
    values: settings.values,
    inspect: settings.inspect,
    normalize: Object.freeze({ trimStrings: settings.trimStrings }),
    codes: settings.codes,
    codegen: settings.codegen,
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

const options: Readonly<Record<keyof Configuration, true>> = {
  messages: true,
  values: true,
  inspect: true,
  normalize: true,
  codes: true,
  codegen: true,
};

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

/**
 * The settings the options change.
 *
 * @throws {@link TypeError} when an option doesn't exist or has a value it doesn't take.
 *
 * @internal
 */
const changesOf = (given: Configuration): Partial<Settings> => {
  const unknown = Object.keys(given).find((name) => !Object.hasOwn(options, name));

  if (unknown !== undefined) {
    fail(`there is no option ${unknown}`);
  }

  checkMessages(given.messages);

  choice('values', given.values, ['show', 'length', 'hide']);
  choice('inspect', given.inspect, ['show', 'hide']);
  choice('codes', given.codes, [true, false]);
  choice('codegen', given.codegen, ['auto', 'off']);

  const trimStrings = trimStringsOf(given.normalize);

  return {
    ...('messages' in given ? { messages: frozen(given.messages) } : {}),
    ...(given.values === undefined ? {} : { values: given.values }),
    ...(given.inspect === undefined ? {} : { inspect: given.inspect }),
    ...(trimStrings === undefined ? {} : { trimStrings }),
    ...(given.codes === undefined ? {} : { codes: given.codes }),
    ...(given.codegen === undefined ? {} : { codegen: given.codegen }),
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
 * after the call.
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

  return previous;
};
