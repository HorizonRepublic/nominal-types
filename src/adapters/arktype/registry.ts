import type { AnyConstraint } from '../../core/constraint-types.ts';
import type { AnyNominalType } from '../../core/contracts.ts';

/**
 * Internal: the meta key that marks an ArkType node made by `toArk()`, holding the id of its type.
 */
export const typeKey = 'x-nominal-type';

/**
 * Internal: the meta key that lists the constraints `constrainArk()` attached to an ArkType object.
 */
export const constraintsKey = 'x-nominal-constraints';

interface ArkRegistry {
  readonly types: Map<string, AnyNominalType>;
  readonly ids: WeakMap<AnyNominalType, string>;
  readonly constraints: Map<string, AnyConstraint>;
}

const key = Symbol.for('@horizon-republic/nominal-types/arktype/2');

const existing: unknown = Reflect.get(globalThis, key);

const isRegistry = (value: unknown): value is ArkRegistry =>
  typeof value === 'object' &&
  value !== null &&
  Reflect.get(value, 'types') instanceof Map &&
  Reflect.get(value, 'ids') instanceof WeakMap;

/**
 * Internal: what `toArk()` and `constrainArk()` put in ArkType meta refers to these maps, shared by
 * every copy of the adapter, since meta holds only JSON values.
 */
export const registry: ArkRegistry = isRegistry(existing)
  ? existing
  : (() => {
      const state: ArkRegistry = { types: new Map(), ids: new WeakMap(), constraints: new Map() };

      Reflect.set(globalThis, key, state);

      return state;
    })();

/**
 * Internal: the id of a type, the same for the same class every time.
 *
 * @remarks
 * An id rather than the name, so each node builds instances of the very class it was given, even
 * where two copies of the package hold two classes of one name.
 */
export const typeIdOf = (target: AnyNominalType): string => {
  const known = registry.ids.get(target);

  if (known !== undefined) {
    return known;
  }

  const id = `${target.typeName}#${String(registry.types.size + 1)}`;

  registry.ids.set(target, id);
  registry.types.set(id, target);

  return id;
};

/**
 * Internal: an id for a constraint, the same for the same constraint every time.
 */
export const constraintId = (constraint: AnyConstraint): string => {
  for (const [id, known] of registry.constraints) {
    if (known === constraint) {
      return id;
    }
  }

  const id = `c${String(registry.constraints.size + 1)}`;

  registry.constraints.set(id, constraint);

  return id;
};
