import type { Arbitrary } from 'fast-check';

import type { AnyNominalType } from '../core/contracts.ts';

/**
 * Internal: what the generators of types, schemas and fields share while one target is walked:
 * the generators the caller passed, and the way back to each other.
 */
export interface GeneratorContext {
  readonly overrides: ReadonlyMap<object, Arbitrary<unknown>>;
  readonly ofType: (type: AnyNominalType) => Arbitrary<unknown>;
  readonly ofSchema: (schema: object) => Arbitrary<unknown>;
  readonly ofField: (field: unknown, key: string) => Arbitrary<unknown>;
}
