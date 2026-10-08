/**
 * Internal: state every copy of this package loaded into one application shares, so a type, a
 * schema or a text form from an ES module copy works with adapters loaded as CommonJS.
 *
 * @remarks
 * It lives on `globalThis` under a `Symbol.for` key, the same way brands make `instanceof` hold
 * across copies. The key carries a version, so a future copy with a different layout keeps its own.
 */
export interface SharedState {
  readonly types: Map<string, { readonly type: object; readonly signature: string }>;
  readonly textForms: WeakMap<object, (text: string) => unknown>;
  /**
   * Read by earlier copies only: a copy keeps its runners to itself now, since another copy
   * can't recognise the rejections they return.
   */
  readonly runners: WeakMap<object, (input: unknown) => unknown>;
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
 * Internal: the shared state, created by the first copy that loads.
 */
export const shared: SharedState = isSharedState(existing)
  ? existing
  : (() => {
      const state = create();

      Reflect.set(globalThis, key, state);

      return state;
    })();
