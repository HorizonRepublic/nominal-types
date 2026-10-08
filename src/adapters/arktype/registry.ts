import type { AnyConstraint } from '../../core/constraint-types.ts';
import type { AnyNominalType } from '../../core/contracts.ts';

/**
 * The meta key that marks an ArkType node made by `toArk()`, holding the id of its type.
 *
 * @internal
 */
export const typeKey = 'x-nominal-type';

/**
 * The meta key that lists the constraints `constrainArk()` attached to an ArkType object.
 *
 * @internal
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
 * What `toArk()` and `constrainArk()` put in ArkType meta refers to these maps, shared by
 * every copy of the adapter, since meta holds only JSON values.
 *
 * @internal
 */
export const registry: ArkRegistry = isRegistry(existing)
  ? existing
  : (() => {
      const state: ArkRegistry = { types: new Map(), ids: new WeakMap(), constraints: new Map() };

      Reflect.set(globalThis, key, state);

      return state;
    })();

/**
 * The id of a type, the same for the same class every time.
 *
 * @remarks
 * An id rather than the name, so each node builds instances of the very class it was given, even
 * where two copies of the package hold two classes of one name.
 *
 * @internal
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
 * An id for a constraint, the same for the same constraint every time.
 *
 * @internal
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
