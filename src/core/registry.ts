const types = new Map<string, object>();

/**
 * Internal: remembers a type under its name, as `Nominal()`, `subtype()` and `variant()` declare
 * it. Names are unique within an application, so the last type declared with a name wins.
 */
export const registerType = (name: string, type: object): void => {
  types.set(name, type);
};

/**
 * Internal: the type declared with a name, if any.
 */
export const typeNamed = (name: string): object | undefined => types.get(name);
