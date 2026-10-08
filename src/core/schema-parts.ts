import type { ArrayOptions } from './array-bounds.ts';
import type { AnyNominalType } from './contracts.ts';

/**
 * Internal: what a schema built by `n.of()`, `n.object()` or `n.union()` is made of, for tools
 * that walk a schema, such as the generators of the `testing` entry point.
 */
export type SchemaParts =
  | { readonly kind: 'type'; readonly type: AnyNominalType }
  | { readonly kind: 'array'; readonly item: object; readonly options: ArrayOptions }
  | { readonly kind: 'optional' | 'nullable' | 'text'; readonly item: object }
  | {
      readonly kind: 'object';
      readonly fields: ReadonlyArray<{
        readonly key: string;
        readonly optional: boolean;
        readonly field: unknown;
      }>;
      readonly strict: boolean;
    }
  | {
      readonly kind: 'union';
      readonly key: string;
      readonly variants: ReadonlyArray<{ readonly tag: string; readonly variant: object }>;
    };

const key = Symbol.for('@horizon-republic/nominal-types/schema-parts/1');

const isPartsMap = (value: unknown): value is WeakMap<object, SchemaParts> =>
  value instanceof WeakMap;

let found: WeakMap<object, SchemaParts> | undefined;

// Shared by every copy of the package in one application, as `shared.ts` is, so an entry point
// bundled as CommonJS with a copy of its own reads the schemas the main entry point built. Found
// on first use, so an app bundle that builds no schema leaves it out.
const parts = (): WeakMap<object, SchemaParts> => {
  if (found === undefined) {
    const existing: unknown = Reflect.get(globalThis, key);

    found = isPartsMap(existing) ? existing : new WeakMap();
    Reflect.set(globalThis, key, found);
  }

  return found;
};

const owners = new WeakMap<object, object>();

/**
 * Internal: records the schema that owns `paths` and what it is made of, as its paths know it:
 * the `item` of a shape around another schema is that schema's paths, recorded before.
 */
export const recordParts = (schema: object, paths: object, pathParts?: SchemaParts): void => {
  owners.set(paths, schema);

  if (pathParts === undefined) {
    return;
  }

  parts().set(
    schema,
    'item' in pathParts
      ? { ...pathParts, item: owners.get(pathParts.item) ?? pathParts.item }
      : pathParts,
  );
};

/**
 * Internal: what a schema is made of, or `undefined` for a schema no copy of this package built.
 */
export const partsOf = (schema: object): SchemaParts | undefined => parts().get(schema);
