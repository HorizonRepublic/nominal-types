import { type } from 'arktype';
import type { Out, Type } from 'arktype';

import type { AnyNominalType, InputOf } from '../../core/contracts.ts';
import { issueText } from '../../core/issue-text.ts';
import { checkerFor } from '../../core/nominal.ts';
import { Rejection } from '../../core/rejection.ts';
import { typeIdOf, typeKey } from './registry.ts';

/**
 * The ArkType node `arkOf()` returns: it takes the type's input, and `arkSchema()` gives an
 * instance for it.
 */
export type ArkOf<Target extends AnyNominalType> = Type<
  (input: InputOf<Target['rule']>) => Out<Target['prototype']>
>;

/**
 * A nominal type as a native ArkType node, for fields of an ArkType object that `arkSchema()`
 * turns into instances.
 *
 * @remarks
 * ArkType checks the field on its fast path with the type's own rules and messages, with no morph:
 * a morph costs far more than the check. Called directly, the ArkType object returns the field as
 * it came; `arkSchema()` builds the instances afterwards. Use ArkType's own `.array()`, `'key?'`
 * and `.or('null')` around it.
 *
 * @example
 * ```ts
 * const CreateUser = arkSchema(type({ id: arkOf(Uuid), email: arkOf(Email), 'name?': 'string' }));
 * ```
 */
export const arkOf = <Target extends AnyNominalType>(target: Target): ArkOf<Target> => {
  const check = checkerFor(target);

  const problem = (error: { readonly data: unknown }): string => {
    const result = check(error.data);

    return result instanceof Rejection
      ? result.issues.map((issue) => issueText(issue)).join('; ')
      : `must be ${target.typeName}`;
  };

  // A one-argument predicate keeps ArkType on its fast path; the message is built on failure only.
  const meta = { [typeKey]: typeIdOf(target), description: target.typeName, problem };
  const node = type('unknown')
    .narrow((value) => !(check(value) instanceof Rejection))
    .configure(meta);

  // The node's output is what arkSchema() builds from it; the type says so for inference.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return node as unknown as ArkOf<Target>;
};
