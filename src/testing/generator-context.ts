import type { Arbitrary } from 'fast-check';

import type { AnyNominalType } from '../core/contracts.ts';

/**
 * What the generators of types, schemas and fields share while one target is walked:
 * the generators the caller passed, and the way back to each other.
 *
 * @internal
 */
export interface GeneratorContext {
  /**
   * The generators the caller passed, keyed by the type, schema or field they make values of.
   */
  readonly overrides: ReadonlyMap<object, Arbitrary<unknown>>;
  /**
   * The generator of a nominal type's inputs, made once per walk.
   */
  readonly ofType: (type: AnyNominalType) => Arbitrary<unknown>;
  /**
   * The generator of a schema's inputs, made once per walk.
   */
  readonly ofSchema: (schema: object) => Arbitrary<unknown>;
  /**
   * The generator of an object field's inputs; `key` names the field in error messages.
   */
  readonly ofField: (field: unknown, key: string) => Arbitrary<unknown>;
}
