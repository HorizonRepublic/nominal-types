import { settleParts } from './deferred-parts.ts';
import { holdsEscapeFreeText } from './escape-free.ts';
import { rulesOf } from './hierarchy.ts';

type Write = (value: unknown) => unknown;

/**
 * The shape of what a schema gives, as the JSON writer generated for it reads it.
 *
 * @internal
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
 * A field of an object plan.
 *
 * @internal
 */
export interface PlanField {
  /**
   * The key of the field in the object.
   */
  readonly key: string;
  /**
   * Whether the field may be missing, so the text leaves it out when it is.
   */
  readonly optional: boolean;
  /**
   * How the value of the field is written.
   */
  readonly plan: Plan;
}

/**
 * The plans of the schemas this copy of the package built, so a schema that holds
 * another as a field writes it in the same function.
 *
 * @internal
 */
export const plans: WeakMap<object, Plan> = new WeakMap();

/**
 * What the writer needs of the root class, which it can't import without a cycle.
 *
 * @internal
 */
export interface Instances {
  /**
   * The root class every nominal type of this copy of the package extends.
   */
  readonly root: object;
  /**
   * Whether a value is a nominal type declared with this copy of the package.
   */
  readonly isOwn: (value: unknown) => boolean;
  /**
   * The value an instance was built with, or a value no instance holds.
   */
  readonly checked: (instance: object) => unknown;
}

/**
 * JSON text, or `undefined` for a value JSON leaves out.
 *
 * @internal
 */
export type Stringify = (value: unknown) => string | undefined;

/**
 * How a type's instances are written: a string known to need no escaping, any primitive
 * value, a big integer, as an object plan, or through `JSON.stringify()`, which calls a `toJSON()`
 * of the type's own and covers the types of another copy of the package.
 *
 * @internal
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
 * How the instances of `type` are written, worked out once per type.
 *
 * @internal
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
 * A string as JSON text, between quotes, escaped only when it holds a character that needs it.
 * The generated writers call it.
 *
 * @internal
 */
export const text = (value: string): string =>
  needsEscape.test(value) ? JSON.stringify(value) : `"${value}"`;

/**
 * A number as JSON text, `null` for `NaN` and the infinities, as `JSON.stringify()` writes
 * them. The generated writers call it.
 *
 * @internal
 */
export const number = (value: number): string => (Number.isFinite(value) ? `${value}` : 'null');

/**
 * A value as `JSON.stringify()` writes it, for the generated writers to call.
 *
 * @throws {@link TypeError} when the value holds a bigint or refers to itself.
 *
 * @internal
 */
export const json = (value: unknown): string | undefined => JSON.stringify(value);
