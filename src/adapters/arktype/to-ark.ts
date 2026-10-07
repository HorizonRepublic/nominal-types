import { type } from 'arktype';
import type { Out, Type } from 'arktype';

import type { AnyNominalType, InputOf } from '../../core/contracts.ts';
import { issueText } from '../../core/issue-text.ts';
import { Rejection } from '../../core/rejection.ts';
import { checkerFor } from '../../core/type-functions.ts';
import { typeIdOf, typeKey } from './registry.ts';

/**
 * The ArkType node `toArk()` returns: it takes the type's input, and `fromArk()` gives an
 * instance for it.
 */
export type ArkField<Target extends AnyNominalType> = Type<
  (input: InputOf<Target['rule']>) => Out<Target['prototype']>
>;

/**
 * A nominal type as a native ArkType node, for fields of an ArkType object that `fromArk()`
 * turns into instances.
 *
 * @remarks
 * ArkType checks the field on its fast path with the type's own rules and messages, with no morph:
 * a morph costs far more than the check. Called directly, the ArkType object returns the field as
 * it came; `fromArk()` builds the instances afterwards. Use ArkType's own `.array()`, `'key?'`
 * and `.or('null')` around it.
 *
 * @example
 * ```ts
 * const CreateUser = fromArk(type({ id: toArk(Uuid), email: toArk(Email), 'name?': 'string' }));
 * ```
 */
export const toArk = <Target extends AnyNominalType>(target: Target): ArkField<Target> => {
  const check = checkerFor(target);

  const problem = (error: { readonly data: unknown }): string => {
    const result = check(error.data);

    return result instanceof Rejection
      ? result.issues.map((issue) => issueText(issue)).join('; ')
      : `must be ${target.typeName}`;
  };

  // A one-argument predicate keeps ArkType on its fast path; the message is built on failure only.
  const description: unknown = Reflect.get(target.rule, 'description');
  const meta = {
    [typeKey]: typeIdOf(target),
    description: typeof description === 'string' ? description : target.typeName,
    problem,
  };
  const node = type('unknown')
    .narrow((value) => !(check(value) instanceof Rejection))
    .configure(meta);

  // The node's output is what fromArk() builds from it; the type says so for inference.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return node as unknown as ArkField<Target>;
};
