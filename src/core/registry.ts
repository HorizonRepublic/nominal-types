import { shared } from './shared.ts';

const warned = new Set<string>();

/**
 * Internal: remembers a type under its name, as `Nominal()`, `subtype()` and `variant()` declare
 * it, and warns once when a different type takes a name already in use.
 *
 * @remarks
 * Names are unique within an application: two types with one name share their brand and pass for
 * each other. Declaring the same type again, as a second copy of the package or a module reloaded
 * in development does, keeps the signature and stays silent. The last type declared with a name
 * wins.
 */
export const registerType = (name: string, type: object, signature: string): void => {
  const known = shared.types.get(name);
  if (known !== undefined && known.signature !== signature && !warned.has(name)) {
    warned.add(name);
    // The warning is the point: a clash breaks types silently, and the package runs outside Node too.
    // oxlint-disable-next-line no-console
    console.warn(
      `@horizon-republic/nominal-types: the type name "${name}" is declared twice with different rules; the two types will pass for each other. Give each type a unique name.`,
    );
  }
  shared.types.set(name, { type, signature });
};

/**
 * Internal: the type declared with a name, if any.
 */
export const typeNamed = (name: string): object | undefined => shared.types.get(name)?.type;
