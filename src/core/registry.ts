import type { NominalSchema } from './contracts.ts';
import { fingerprintOf } from './fingerprint.ts';
import { shared } from './shared.ts';
import { checkTypeName } from './type-name.ts';

const warned = new Set<string>();

/**
 * Internal: remembers a type under its name, as `Nominal()`, `subtype()` and `variant()` declare
 * it, and warns once when a different type takes a name already in use.
 *
 * @throws TypeError for a name that can't serve as a schema name, before anything is remembered.
 *
 * @remarks
 * Names are unique within an application: two types with one name share their brand and pass for
 * each other. Declaring the same type again, as a second copy of the package or a module reloaded
 * in development does, keeps the signature and stays silent. The last type declared with a name
 * wins.
 */
export const registerType = (
  name: string,
  type: object,
  declared: {
    readonly parent: string;
    readonly base: boolean;
    readonly rule: NominalSchema | undefined;
  },
): void => {
  checkTypeName(name);

  const signature = `${declared.parent}|${String(declared.base)}|${fingerprintOf(declared.rule)}`;

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

/**
 * Internal: the type declared with a name, or else the one type whose name ends in `.<name>`, for
 * documents that name schemas after classes: `InvoiceNumber` finds `billing.InvoiceNumber`.
 *
 * @remarks
 * Types named in `claimed` have a schema of their own under their full name, so they don't
 * compete for a short one. Two other types ending in the same part, such as `billing.Email` and
 * `nominal.Email`, find neither.
 */
export const typeForSchemaName = (
  name: string,
  claimed: ReadonlySet<string> = new Set(),
): object | undefined => {
  const exact = typeNamed(name);

  if (exact !== undefined) {
    return exact;
  }

  const found = [...shared.types].filter(
    ([typeName]) => typeName.endsWith(`.${name}`) && !claimed.has(typeName),
  );

  return found.length === 1 ? found[0]?.[1].type : undefined;
};
