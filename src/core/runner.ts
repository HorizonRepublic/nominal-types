/**
 * Internal: the functions that run schemas built by `schemaOf()`, returning the value or a
 * `Rejection`, so a chain can call them without going through `validate`.
 */
export const runners: WeakMap<object, (input: unknown) => unknown> = new WeakMap();
