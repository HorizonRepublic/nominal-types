import type { ConstraintField } from './constraint-types.ts';
import type { AnyNominalType } from './contracts.ts';
import { isNominalType } from './nominal.ts';
import { fieldRunner } from './object-helpers.ts';
import { partsOf } from './schema-parts.ts';
import { checkerFor } from './type-functions.ts';

/**
 * The nominal type a key schema checks keys against: the type itself, or the type of `n.of()`.
 *
 * @internal
 */
export const keyTypeOf = (key: ConstraintField): AnyNominalType | undefined => {
  if (isNominalType(key)) {
    return key;
  }

  const parts = partsOf(key);

  return parts?.kind === 'type' ? parts.type : undefined;
};

/**
 * What checks the keys of a record: a key is a string, so a nominal type of keys, alone or in
 * `n.of()`, runs its rules without making an instance.
 *
 * @internal
 */
export const keyRunner = (key: ConstraintField): ((input?: unknown) => unknown) => {
  const type = keyTypeOf(key);

  return type === undefined ? fieldRunner(key, 'n.record()') : checkerFor(type);
};
