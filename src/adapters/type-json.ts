import type { AnyNominalType } from '../core/contracts.ts';
import { withoutUri } from '../core/json-target.ts';

/**
 * A type's JSON Schema for draft 2020-12 without `$schema`, for libraries that take it as
 * metadata, or `undefined` for a type whose rules can't describe themselves.
 *
 * @internal
 */
export const typeJsonOf = (target: AnyNominalType): Record<string, unknown> | undefined => {
  try {
    return withoutUri(target['~standard'].jsonSchema.input({ target: 'draft-2020-12' }));
  } catch {
    return undefined;
  }
};
