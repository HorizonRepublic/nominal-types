import type { Messages } from './issue-codes.ts';

/**
 * Internal: what `n.configure()` has set, read where it applies: in a message as it is written,
 * when code is generated, and in the check of a string type.
 *
 * @remarks
 * One object for the whole process, kept on `globalThis` under a `Symbol.for` key, so the ES module
 * and CommonJS copies of the package read the same settings. It is changed in place and never
 * replaced, so generated code can hold it, and its fields keep one shape.
 */
export interface Settings {
  messages: Messages | undefined;
  values: 'show' | 'length' | 'hide';
  inspect: 'show' | 'hide';
  trimStrings: boolean;
  codes: boolean;
  codegen: 'auto' | 'off';
}

const key = Symbol.for('@horizon-republic/nominal-types/settings/1');

/**
 * Internal: the settings every type starts with, which keep the package as it is unconfigured.
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
 * Internal: the settings in force, created by the first copy of the package that loads.
 */
export const settings: Settings = isSettings(existing)
  ? existing
  : (() => {
      const created: Settings = { ...defaults };

      Reflect.set(globalThis, key, created);

      return created;
    })();
