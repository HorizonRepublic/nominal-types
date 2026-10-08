import type { Messages } from './issue-codes.ts';

/**
 * What `n.configure()` has set, read where it applies: in a message as it is written,
 * when code is generated, and in the check of a string type.
 *
 * @remarks
 * One object for the whole process, kept on `globalThis` under a `Symbol.for` key, so the ES module
 * and CommonJS copies of the package read the same settings. It is changed in place and never
 * replaced, so generated code can hold it, and its fields keep one shape.
 *
 * @internal
 */
export interface Settings {
  /**
   * The messages in place of the English ones, or `undefined` for the English messages.
   */
  messages: Messages | undefined;
  /**
   * How messages show the rejected value.
   */
  values: 'show' | 'length' | 'hide';
  /**
   * Whether `console.log` and `util.inspect` show the values of instances.
   */
  inspect: 'show' | 'hide';
  /**
   * Whether strings are trimmed before the check.
   */
  trimStrings: boolean;
  /**
   * Whether every issue carries its `code`.
   */
  codes: boolean;
  /**
   * Whether checks may be built with generated code.
   */
  codegen: 'auto' | 'off';
}

const key = Symbol.for('@horizon-republic/nominal-types/settings/1');

/**
 * The settings every type starts with, which keep the package as it is unconfigured.
 *
 * @internal
 */
export const defaults: Readonly<Settings> = Object.freeze({
  messages: undefined,
  values: 'show',
  inspect: 'show',
  trimStrings: false,
  codes: false,
  codegen: 'auto',
});

const isSettings = (value: unknown): value is Settings =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'values') === 'string';

const existing: unknown = Reflect.get(globalThis, key);

/**
 * The settings in force, created by the first copy of the package that loads.
 *
 * @internal
 */
export const settings: Settings = isSettings(existing)
  ? existing
  : (() => {
      const created: Settings = { ...defaults };

      Reflect.set(globalThis, key, created);

      return created;
    })();
