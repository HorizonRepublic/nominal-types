import { settleParts } from './deferred-parts.ts';
import { holdsEscapeFreeText } from './escape-free.ts';
import { rulesOf } from './hierarchy.ts';

type Write = (value: unknown) => unknown;

/**
 * Internal: the shape of what a schema gives, as the JSON writer generated for it reads it.
 */
export type Plan =
  | { readonly kind: 'type'; readonly type: object }
  | { readonly kind: 'array'; readonly item: Plan }
  | { readonly kind: 'empty'; readonly item: Plan; readonly empty: undefined | null }
  | {
      readonly kind: 'object';
      readonly fields: readonly PlanField[];
      readonly write: Write;
    }
  | {
      readonly kind: 'union';
      readonly key: string;
      readonly variants: ReadonlyArray<{ readonly tag: string; readonly plan: Plan }>;
      readonly write: Write;
    }
  | { readonly kind: 'tag'; readonly tag: string }
  | { readonly kind: 'json'; readonly write: Write };

/**
 * Internal: a field of an object plan.
 */
export interface PlanField {
  readonly key: string;
  readonly optional: boolean;
  readonly plan: Plan;
}

/**
 * Internal: the plans of the schemas this copy of the package built, so a schema that holds
 * another as a field writes it in the same function.
 */
export const plans: WeakMap<object, Plan> = new WeakMap();

/**
 * Internal: what the writer needs of the root class, which it can't import without a cycle.
 */
export interface Instances {
  readonly root: object;
  readonly isOwn: (value: unknown) => boolean;
  /** The value an instance was built with, or a value no instance holds. */
  readonly checked: (instance: object) => unknown;
}

/**
 * Internal: JSON text, or `undefined` for a value JSON leaves out.
 */
export type Stringify = (value: unknown) => string | undefined;

/**
 * Internal: how a type's instances are written: a string known to need no escaping, any primitive
 * value, a big integer, as an object plan, or through `JSON.stringify()`, which calls a `toJSON()`
 * of the type's own and covers the types of another copy of the package.
 */
export type Leaf = 'safe' | 'value' | 'bigint' | 'json' | Plan;

const toJsonOwner = (prototype: unknown): unknown => {
  let current = prototype;

  while (typeof current === 'object' && current !== null && !Object.hasOwn(current, 'toJSON')) {
    current = Object.getPrototypeOf(current);
  }

  return current;
};

const findLeaf = (type: object, { root, isOwn }: Instances): Leaf => {
  if (!isOwn(type)) {
    return 'json';
  }

  const owner = toJsonOwner(Reflect.get(type, 'prototype'));

  if (owner !== Reflect.get(root, 'prototype')) {
    const ownerType: unknown = Reflect.get(owner ?? {}, 'constructor');

    return Reflect.get(ownerType ?? {}, 'typeName') === 'nominal.AnyBigInt' ? 'bigint' : 'json';
  }

  const rule = rulesOf(root, type).at(-1) ?? {};

  settleParts(rule);

  const objectPlan = plans.get(rule);

  if (objectPlan?.kind === 'object') {
    return objectPlan;
  }

  return holdsEscapeFreeText(root, type) ? 'safe' : 'value';
};

const leaves = new WeakMap<object, Leaf>();

/**
 * Internal: how the instances of `type` are written, worked out once per type.
 */
export const leafOf = (type: object, instances: Instances): Leaf => {
  let leaf = leaves.get(type);

  if (leaf === undefined) {
    leaf = findLeaf(type, instances);
    leaves.set(type, leaf);
  }

  return leaf;
};

// What JSON.stringify() escapes: `"`, `\`, control characters and lone surrogates; with the u
// flag a well-formed pair is one code point, which the class doesn't hold.
// oxlint-disable-next-line no-control-regex
const needsEscape = /["\\\u0000-\u001F\uD800-\uDFFF]/u;

/**
 * Internal: a helper the generated writers call.
 */
export const text = (value: string): string =>
  needsEscape.test(value) ? JSON.stringify(value) : `"${value}"`;

/**
 * Internal: a helper the generated writers call.
 */
export const number = (value: number): string => (Number.isFinite(value) ? `${value}` : 'null');

/**
 * Internal: a helper the generated writers call.
 */
export const json = (value: unknown): string | undefined => JSON.stringify(value);
