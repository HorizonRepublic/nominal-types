/**
 * State every copy of this package loaded into one application shares, so a type, a
 * schema or a text form from an ES module copy works with adapters loaded as CommonJS.
 *
 * @remarks
 * It lives on `globalThis` under a `Symbol.for` key, the same way brands make `instanceof` hold
 * across copies. The key carries a version, so a future copy with a different layout keeps its own.
 *
 * @internal
 */
export interface SharedState {
  /**
   * The types declared so far, by name, with the signature that tells a type declared again from a
   * different one.
   */
  readonly types: Map<string, { readonly type: object; readonly signature: string }>;
  /**
   * The text form of each type that has one: how it reads a value from text.
   */
  readonly textForms: WeakMap<object, (text: string) => unknown>;
  /**
   * Read by earlier copies only: a copy keeps its runners to itself now, since another copy
   * can't recognise the rejections they return.
   */
  readonly runners: WeakMap<object, (input: unknown) => unknown>;
  /**
   * The `n.of()` schemas that hold an array.
   */
  readonly arraySchemas: WeakSet<object>;
}

const key = Symbol.for('@horizon-republic/nominal-types/shared/1');

const create = (): SharedState => ({
  types: new Map(),
  textForms: new WeakMap(),
  runners: new WeakMap(),
  arraySchemas: new WeakSet(),
});

const existing: unknown = Reflect.get(globalThis, key);

const isSharedState = (value: unknown): value is SharedState =>
  typeof value === 'object' && value !== null && Reflect.get(value, 'types') instanceof Map;

/**
 * The shared state, created by the first copy that loads.
 *
 * @internal
 */
export const shared: SharedState = isSharedState(existing)
  ? existing
  : (() => {
      const state = create();

      Reflect.set(globalThis, key, state);

      return state;
    })();
