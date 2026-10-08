import { standIns } from './hierarchy.ts';
import { vendor } from './standard-props.ts';

/**
 * Stands for a type in `implies` by the names of its brands, so a built-in type can imply another
 * without bringing that type's class and rules into every bundle that uses it.
 *
 * @remarks
 * The names are the type's own and those of every type above it but the root; tests check them
 * against the real type.
 *
 * @param names - The brand names, the type's own last.
 * @returns The stand-in, which the caller types as the type it stands for.
 * @internal
 */
export const standIn = (...names: readonly string[]): object => {
  const prototype = {};

  for (const name of names) {
    Object.defineProperty(prototype, Symbol.for(`${vendor}/${name}`), { value: true });
  }

  const stand = { typeName: names.at(-1), prototype };

  standIns.add(stand);

  return stand;
};
