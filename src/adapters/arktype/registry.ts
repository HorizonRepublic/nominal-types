import type { AnyConstraint } from '../../core/constraint-types.ts';
import type { AnyNominalType } from '../../core/contracts.ts';

/**
 * Internal: the meta key that marks an ArkType node made by `arkOf()`, holding the type's name.
 */
export const typeKey = 'x-nominal-type';

/**
 * Internal: the meta key that lists the constraints `constrain()` attached to an ArkType object.
 */
export const constraintsKey = 'x-nominal-constraints';

interface ArkRegistry {
  readonly types: Map<string, AnyNominalType>;
  readonly constraints: Map<string, AnyConstraint>;
}

const key = Symbol.for('@horizon-republic/nominal-types/arktype/1');

const existing: unknown = Reflect.get(globalThis, key);

const isRegistry = (value: unknown): value is ArkRegistry =>
  typeof value === 'object' && value !== null && Reflect.get(value, 'types') instanceof Map;

/**
 * Internal: what `arkOf()` and `constrain()` put in ArkType meta refers to these maps, shared by
 * every copy of the adapter, since meta holds only JSON values.
 */
export const registry: ArkRegistry = isRegistry(existing)
  ? existing
  : (() => {
      const state: ArkRegistry = { types: new Map(), constraints: new Map() };

      Reflect.set(globalThis, key, state);

      return state;
    })();

/**
 * Internal: remembers the type behind a name, keeping the first one.
 *
 * @remarks
 * Two copies of the package hold two classes for one type, and `instanceof` holds across them, so
 * either serves; two different types under one name are warned about where they are declared.
 */
export const rememberType = (target: AnyNominalType): void => {
  if (!registry.types.has(target.typeName)) {
    registry.types.set(target.typeName, target);
  }
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
